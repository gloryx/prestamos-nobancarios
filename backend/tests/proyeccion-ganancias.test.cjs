const test = require('node:test');
const assert = require('node:assert/strict');
const { buildProyeccion } = require('../dist/modules/analisis-financiero/application/proyeccion-aggregation');
const { AnalisisFinancieroUseCase } = require('../dist/modules/analisis-financiero/application/analisis-financiero.use-case');
const { BadRequestException } = require('@nestjs/common');

const loan = (id, interes, estado = 'ACTIVO') => ({ id, clienteId: id, cliente: `Client ${id}`, interes, estado });
const plan = (id, prestamoId, numeroPago, fecha, montoProgramado) => ({ id, prestamoId, numeroPago, fechaVencimiento: fecha, montoProgramado });
const payment = (planPagoId, prestamoId, monto, interesAplicado = 0) => ({ planPagoId, prestamoId, monto, interesAplicado });
const data = (planes, interes = 100) => ({ prestamos: [loan(1, interes)], planes, pagos: [] });
const today = new Date('2024-01-31T23:59:59Z');

test('supports every date horizon with inclusive boundaries and exclusive next days', () => {
  const planes = [
    plan(1, 1, 1, '2024-01-30', 100),
    plan(2, 1, 2, '2024-01-31', 100),
    plan(3, 1, 3, '2024-02-15', 100),
    plan(4, 1, 4, '2024-02-16', 100),
    plan(5, 1, 5, '2024-02-29', 100),
    plan(6, 1, 6, '2024-03-31', 100),
    plan(7, 1, 7, '2024-04-30', 100),
    plan(8, 1, 8, '2024-05-01', 100),
  ];
  const expected = { '15d': 25, '1m': 50, '2m': 62.5, '3m': 75 };
  for (const [periodo, projected] of Object.entries(expected)) {
    const result = buildProyeccion(data(planes), periodo, today);
    assert.equal(result.desdeFecha, '2024-01-31');
    assert.equal(result.hastaFecha, periodo === '15d' ? '2024-02-15' : periodo === '1m' ? '2024-02-29' : periodo === '2m' ? '2024-03-31' : '2024-04-30');
    assert.equal(result.prestamos[0].proyeccionPeriodo, projected);
  }
});

test('uses the maximum pending valid active installment for the cartera horizon', () => {
  const result = buildProyeccion({ prestamos: [loan(1, 10), loan(2, 10)], planes: [plan(1, 1, 1, '2024-02-10', 100), plan(2, 1, 2, '2024-03-10', 100), plan(3, 2, 1, '2024-02-20', 100)], pagos: [payment(2, 1, 100)] }, 'cartera', today);
  assert.equal(result.hastaFecha, '2024-02-20');
  assert.equal(result.prestamos[0].cuotas.length, 1);
  assert.equal(result.prestamos[1].cuotas.length, 1);
});

test('returns null cartera end when there is no valid pending installment', () => {
  const result = buildProyeccion({ prestamos: [loan(1, 3)], planes: [plan(1, 1, 1, '2024-02-10', 100)], pagos: [payment(1, 1, 100)] }, 'cartera', today);
  assert.equal(result.hastaFecha, null);
});

test('handles year changes and leap-year month clamping without rollover', () => {
  const result = buildProyeccion(data([plan(1, 1, 1, '2024-02-29', 100), plan(2, 1, 2, '2025-02-28', 100)]), '1m', new Date('2024-01-31T00:00:00Z'));
  assert.equal(result.hastaFecha, '2024-02-29');
  const nextYear = buildProyeccion(data([plan(3, 1, 1, '2025-01-01', 100), plan(4, 1, 2, '2025-01-02', 100)]), '1m', new Date('2024-12-31T00:00:00Z'));
  assert.equal(nextYear.hastaFecha, '2025-01-31');
  assert.equal(nextYear.prestamos[0].proyeccionPeriodo, 100);
});

test('keeps proportional distribution identical when only the period changes', () => {
  const planes = [plan(1, 1, 1, '2024-02-10', '1.01'), plan(2, 1, 2, '2024-03-10', '2.00'), plan(3, 1, 3, '2024-05-10', '6.99')];
  const month = buildProyeccion(data(planes, '10.00'), '1m', new Date('2024-01-10T00:00:00Z'));
  const cartera = buildProyeccion(data(planes, '10.00'), 'cartera', new Date('2024-01-10T00:00:00Z'));
  assert.deepEqual(month.prestamos[0].cuotas.map((row) => row.interes), cartera.prestamos[0].cuotas.map((row) => row.interes));
  assert.equal(month.prestamos[0].proyeccionPeriodo, 1.01);
  assert.equal(cartera.prestamos[0].proyeccionPeriodo, 10);
});

test('keeps overdue pending installments while excluding them from projection', () => {
  const result = buildProyeccion(data([plan(1, 1, 1, '2024-01-01', 100), plan(2, 1, 2, '2024-02-10', 100)]), '1m', new Date('2024-01-31T00:00:00Z'));
  assert.equal(result.prestamos[0].cuotas.length, 2);
  assert.equal(result.prestamos[0].proyeccionPeriodo, 50);
});

test('subtracts registered payments by plan and keeps zero balances out of future installments', () => {
  const result = buildProyeccion({ prestamos: [loan(2, '10.00')], planes: [plan(10, 2, 1, '2024-01-01', 100), plan(11, 2, 2, '2024-02-20', 250), plan(12, 2, 3, '2024-03-20', 50)], pagos: [payment(10, 2, 100, 2), payment(11, 2, 100, 1)] }, 'cartera', today);
  assert.deepEqual(result.prestamos[0].cuotas.map((row) => row.saldo), [150, 50]);
  assert.equal(result.prestamos[0].cuotasFuturas, 2);
});

test('separates active, incobrable, refinanced and annulled loans', () => {
  const result = buildProyeccion({ prestamos: [loan(6, 5), loan(7, 5, 'INCOBRABLE'), loan(8, 5, 'REFINANCIADO'), loan(9, 5, 'ANULADO')], planes: [], pagos: [] }, '1m', today);
  assert.deepEqual(result.prestamos.map((row) => row.id), [6]);
  assert.deepEqual(result.incobrable.prestamos.map((row) => row.id), [7]);
});

test('validates period whitelist and defaults the backend period to 1m', async () => {
  const repository = { pagos: async () => [], prestamos: async () => [], proyeccion: async () => ({ prestamos: [], planes: [], pagos: [] }) };
  const useCase = new AnalisisFinancieroUseCase(repository);
  await assert.rejects(() => useCase.proyeccion('6'), (error) => error instanceof BadRequestException);
  assert.equal((await useCase.proyeccion()).periodo, '1m');
});
