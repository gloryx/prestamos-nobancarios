const assert = require('node:assert/strict');
const test = require('node:test');
const { economicDateOnly } = require('../dist/common/economic-date');
const { resolveContractualDeadline } = require('../dist/modules/planes-pago/domain/services/calendario-pago');
const { IndicadorCobranzaService, calcularIndicadorCobranza } = require('../dist/modules/prestamos/application/services/indicador-cobranza.service');

const instant = (value) => new Date(value);
const loan = (id, date, payments = 0) => ({
  id,
  estado: 'ACTIVO',
  fechaAlta: new Date(`${date}T00:00:00Z`),
  cantidadPagos: 3,
  montoTotal: 100,
  periodicidadPago: { nombre: 'MENSUAL' },
  payments,
});

test('converts economic instants to Costa Rica civil dates at exact boundaries', () => {
  assert.equal(economicDateOnly(instant('2026-09-16T15:00:00Z')), '2026-09-16');
  assert.equal(economicDateOnly(instant('2026-09-17T03:30:00Z')), '2026-09-16');
  assert.equal(economicDateOnly(instant('2026-09-17T06:30:00Z')), '2026-09-17');
});

test('uses the persisted final installment for customized, fully paid plans', async () => {
  const calls = { totals: 0, overdue: 0, deadlines: 0 };
  const rows = {
    totals: [{ prestamoId: '1', total: '100' }],
    overdue: [],
    deadlines: [{ prestamoId: '1', fechaLimiteContractual: '2027-02-14' }],
  };
  const query = (name) => ({
    select() { return this; }, addSelect() { return this; }, leftJoin() { return this; }, where() { return this; }, andWhere() { return this; },
    groupBy() { return this; }, addGroupBy() { return this; }, having() { return this; },
    async getRawMany() { calls[name] += 1; return rows[name]; },
  });
  const service = new IndicadorCobranzaService({ getRepository: () => ({ createQueryBuilder: (alias) => query(alias === 'pago' ? 'totals' : alias === 'plan' && calls.overdue === 0 ? 'overdue' : 'deadlines') }) });
  const result = await service.calcular([loan(1, '2026-01-01')], new Date('2027-02-14T12:00:00Z'));
  assert.equal(result.get(1).fechaLimiteContractual, '2027-02-14');
  assert.equal(result.get(1).indicadorCobranza, 'SALDADO');
  assert.deepEqual(calls, { totals: 1, overdue: 1, deadlines: 1 });
});

test('keeps the theoretical fallback when no persisted plan exists', () => {
  assert.equal(resolveContractualDeadline(undefined, new Date('2026-08-31T00:00:00Z'), 'MENSUAL', 1), '2026-09-30');
  assert.equal(resolveContractualDeadline('2026-10-20', new Date('2026-08-31T00:00:00Z'), 'MENSUAL', 1), '2026-10-20');
});

test('D: a September 16 installment is not overdue before the Costa Rica economic day changes', () => {
  const cuota = '2026-09-16';
  const hoy = economicDateOnly(instant('2026-09-17T03:30:00Z'));

  assert.equal(hoy, cuota);
  assert.equal(calcularIndicadorCobranza(10, '2026-12-31', hoy, cuota < hoy), 'AL_DIA');
});

test('E: a pending September 16 installment can be overdue once the economic day is September 17', () => {
  const cuota = '2026-09-16';
  const hoy = economicDateOnly(instant('2026-09-17T06:30:00Z'));

  assert.equal(hoy, '2026-09-17');
  assert.equal(calcularIndicadorCobranza(10, '2026-12-31', hoy, cuota < hoy), 'ATRASADO');
});
