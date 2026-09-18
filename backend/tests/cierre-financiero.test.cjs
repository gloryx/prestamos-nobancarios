const test = require('node:test');
const assert = require('node:assert/strict');
const { FinancialPeriodService } = require('../dist/modules/cierre-financiero/application/financial-period.service');
const { ConflictException, BadRequestException } = require('@nestjs/common');
const { EstadoPrestamo } = require('../dist/modules/prestamos/domain/enums/estado-prestamo.enum');
const { economicDateOnly } = require('../dist/common/economic-date');

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
