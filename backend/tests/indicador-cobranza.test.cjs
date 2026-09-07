const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularIndicadorCobranza } = require('../dist/modules/prestamos/application/services/indicador-cobranza.service');
const { calcularFechaLimiteContractual } = require('../dist/modules/planes-pago/domain/services/calendario-pago');

const date = (value) => new Date(`${value}T00:00:00.000Z`);
test('calcula la situación financiera y operativa sin usar estados persistidos', () => {
  assert.equal(calcularIndicadorCobranza(0, '2026-12-31', '2026-01-01', true), 'SALDADO');
  assert.equal(calcularIndicadorCobranza(10, '2026-12-31', '2026-01-01', false), 'AL_DIA');
  assert.equal(calcularIndicadorCobranza(10, '2026-12-31', '2026-01-01', true), 'ATRASADO');
  assert.equal(calcularIndicadorCobranza(10, '2026-12-31', '2026-12-31', false), 'PLAZO_CUMPLIDO');
  assert.equal(calcularIndicadorCobranza(10, '2026-12-31', '2027-01-01', true), 'PLAZO_CUMPLIDO');
  assert.equal(calcularIndicadorCobranza(10, '2026-12-31', '2026-01-01', true), 'ATRASADO'); // parcial o pendiente vencida
  assert.equal(calcularIndicadorCobranza(10, '2026-12-31', '2026-01-01', false), 'AL_DIA'); // pagada vencida o pago histórico sin plan
});

test('aplica domingo a lunes en todas las periodicidades', () => {
  assert.equal(calcularFechaLimiteContractual(date('2026-08-29'), 'DIARIO', 1), '2026-08-31');
  assert.equal(calcularFechaLimiteContractual(date('2026-08-23'), 'SEMANAL', 1), '2026-08-31');
  assert.equal(calcularFechaLimiteContractual(date('2026-08-15'), 'QUINCENAL', 1), '2026-08-31');
  assert.equal(calcularFechaLimiteContractual(date('2026-08-31'), 'MENSUAL', 1), '2026-09-30');
});

test('el límite contractual no cambia cuando cambia, se redistribuye o se elimina el plan', () => {
  const expected = calcularFechaLimiteContractual(date('2026-01-31'), 'MENSUAL', 3);
  assert.equal(expected, '2026-04-30');
  assert.equal(calcularFechaLimiteContractual(date('2026-01-31'), 'MENSUAL', 3), expected);
});

test('estados CANCELADO, REFINANCIADO e INCOBRABLE siguen siendo informativos', () => {
  for (const state of ['CANCELADO', 'REFINANCIADO', 'INCOBRABLE']) assert.equal(calcularIndicadorCobranza(0, '2026-12-31', '2026-01-01', false), 'SALDADO', state);
});
