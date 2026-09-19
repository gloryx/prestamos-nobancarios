const test = require('node:test');
const assert = require('node:assert/strict');
const { FinancialPeriodService } = require('../dist/modules/cierre-financiero/application/financial-period.service');
const { ConflictException, BadRequestException } = require('@nestjs/common');
const { EstadoPrestamo } = require('../dist/modules/prestamos/domain/enums/estado-prestamo.enum');
const { economicDateOnly } = require('../dist/common/economic-date');
const { ConceptoDetalleCorte, EstadoDocumentalCorte } = require('../dist/modules/cierre-financiero/domain/financial.orm-entities');

const previewSnapshot = () => ({
  fechaInicio: '2026-09-01', fechaFin: '2026-09-30', carteraActiva: 0, carteraIncobrable: 0,
  carteraTotal: 0, pagosRecibidos: 0, pagosCapital: 0, pagosInteres: 0, disponibleInicial: 0,
  disponibleFinal: 0, cajaEntradas: 0, cajaSalidas: 0, errors: [], canClose: true,
  detalles: Object.values(ConceptoDetalleCorte).map(concepto => ({ concepto, monto: 0 })),
});

const periodManager = ({ fechaApertura = '2026-09-01', last = null, onSave, onInsert } = {}) => {
  const config = { fechaApertura, carteraInicial: 0, carteraActivaInicial: 0, carteraIncobrableInicial: 0, disponibleInicial: 0 };
  const ordered = {
    orderBy() { return this; }, addOrderBy() { return this; }, setLock() { return this; },
    getOne: async () => last,
  };
  const configQuery = {
    where() { return this; }, setLock() { return this; }, getOne: async () => config,
  };
  return {
    getRepository: entity => {
      if (entity.name.includes('Configuracion')) return { findOne: async () => config, createQueryBuilder: () => configQuery };
      if (entity.name.includes('CierreMensual')) return { createQueryBuilder: () => ordered, save: onSave ?? (async value => ({ id: 1, ...value })), };
      if (entity.name.includes('DetalleCorteMensual')) return { find: async () => [], insert: onInsert ?? (async () => undefined) };
      return { createQueryBuilder: () => ({ where() { return this; }, andWhere() { return this; }, leftJoinAndSelect() { return this; }, getMany: async () => [], }) };
    },
  };
};

test('financial period policy rejects dates before opening and closed periods', async () => {
  const service = new FinancialPeriodService();
  const configRepo = { findOne: async () => ({ fechaApertura: '2026-01-15' }) };
  const closedQuery = { where() { return this; }, getOne: async () => ({ id: 1 }) };
  const manager = { getRepository: entity => entity.name.includes('Configuracion') ? configRepo : {}, createQueryBuilder: () => closedQuery };
  await assert.rejects(() => service.assertOpen(manager, new Date('2026-01-14T00:00:00Z')), BadRequestException);
  await assert.rejects(() => service.assertOpen(manager, new Date('2026-02-01T00:00:00Z')), ConflictException);
});

test('financial opening accepts Costa Rica economic today and rejects a future date', () => {
  const service = new FinancialPeriodService();
  const today = economicDateOnly();
  const tomorrowDate = new Date(`${today}T00:00:00.000Z`);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);
  assert.doesNotThrow(() => service.assertOpeningDate(today));
  assert.throws(() => service.assertOpeningDate(tomorrow), BadRequestException);
});

test('financial calculations load cutoff loan states once and reuse the map', async () => {
  let bulkCalls = 0;
  let individualCalls = 0;
  const service = new FinancialPeriodService({
    estadosDelPrestamoEnFecha: async (_manager, ids) => {
      bulkCalls += 1;
      return new Map(ids.map(id => [id, EstadoPrestamo.ACTIVO]));
    },
    estadoDelPrestamoEnFecha: async () => {
      individualCalls += 1;
      throw new Error('individual history lookup');
    },
  });
  const loans = [
    { id: 1, fechaAlta: '2026-01-01', capital: 100, estado: EstadoPrestamo.ACTIVO },
    { id: 2, fechaAlta: '2026-01-02', capital: 200, estado: EstadoPrestamo.ACTIVO },
  ];
  const queryBuilder = (rows = []) => ({
    where() { return this; }, andWhere() { return this; }, leftJoinAndSelect() { return this; },
    orderBy() { return this; }, addOrderBy() { return this; }, getMany: async () => rows,
  });
  const manager = {
    getRepository: entity => ({
      findOne: async () => ({ fechaApertura: '2026-01-01', disponibleInicial: 0, carteraInicial: 0, carteraActivaInicial: 0, carteraIncobrableInicial: 0 }),
      createQueryBuilder: () => entity.name.includes('Prestamo') ? queryBuilder(loans) : queryBuilder([]),
    }),
  };

  const result = await service.calculate(manager, '2026-01-01', '2026-01-31');
  assert.equal(result.carteraTotal, 300);
  assert.equal(bulkCalls, 1);
  assert.equal(individualCalls, 0);
});

test('current-month preview is informational, not blocked by the close date, and preserves all 22 concepts', async () => {
  const service = new FinancialPeriodService();
  service.calculate = async () => previewSnapshot();
  const manager = periodManager({
    onSave: async () => { throw new Error('preview must not persist a close'); },
    onInsert: async () => { throw new Error('preview must not persist details'); },
  });
  const result = await service.previewClose(manager, 2026, 9);

  assert.equal(result.estadoDocumental, EstadoDocumentalCorte.PENDIENTE_CONFIRMACION);
  assert.equal(result.puedeConfirmar, false);
  assert.equal(result.canClose, false);
  assert.equal(result.fechaFin, '2026-09-30');
  assert.equal(result.detalles.length, 22);
});

test('current-month close remains rejected until the contractual month ends', async () => {
  const service = new FinancialPeriodService();
  service.calculate = async () => previewSnapshot();
  await assert.rejects(() => service.close(periodManager(), 2026, 9, 1), error => {
    assert.ok(error instanceof ConflictException);
    assert.equal(error.message, 'El período aún no ha finalizado económicamente.');
    return true;
  });
});

test('a completed sequential month can be closed without changing preview rules', async () => {
  const service = new FinancialPeriodService();
  service.calculate = async () => ({ ...previewSnapshot(), fechaInicio: '2026-01-01', fechaFin: '2026-01-31' });
  let saved = false;
  const manager = periodManager({
    fechaApertura: '2026-01-01',
    onSave: async value => { saved = true; return { id: 1, ...value }; },
  });

  const result = await service.close(manager, 2026, 1, 1);
  assert.equal(result.id, 1);
  assert.equal(saved, true);
});

test('preview of a future month still rejects a sequence gap with the original 409 message', async () => {
  const service = new FinancialPeriodService();
  await assert.rejects(() => service.previewClose(periodManager(), 2026, 10), error => {
    assert.ok(error instanceof ConflictException);
    assert.equal(error.message, 'Los cierres deben respetar la secuencia mensual sin saltos.');
    return true;
  });
});
