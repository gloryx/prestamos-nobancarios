const assert = require('node:assert/strict');
const test = require('node:test');

const {
  getRegisteredPlanPagoTotals,
  getTotalPlanOperativoPendienteCents,
} = require('../dist/modules/planes-pago/application/services/plan-pago-editability.service');
const { ObtenerPrestamoPorIdUseCase } = require('../dist/modules/prestamos/application/use-cases/obtener-prestamo-por-id.use-case');
const { response } = require('../dist/modules/prestamos/presentation/controllers/prestamos.controller');

const plan = (id, numeroPago, montoProgramado) => ({ id, prestamoId: 1, numeroPago, montoProgramado, fechaVencimiento: new Date('2026-09-05T00:00:00.000Z'), fechaCreacion: new Date() });
const payment = (planPagoId, monto, estado = 'REGISTRADO') => ({ planPagoId, monto, estado });

function consistency(montoTotal, plans, payments = [], estado = 'ACTIVO') {
  const registered = payments.filter((item) => item.estado === 'REGISTRADO');
  const saldoCents = Math.max(0, Math.round(montoTotal * 100) - registered.reduce((sum, item) => sum + Math.round(item.monto * 100), 0));
  const planCents = getTotalPlanOperativoPendienteCents(plans, getRegisteredPlanPagoTotals(payments));
  const diferenciaCents = saldoCents - planCents;
  return { estado, saldoFinanciero: saldoCents / 100, totalPlanOperativoPendiente: planCents / 100, diferenciaPlan: diferenciaCents / 100, planRequiereAjuste: diferenciaCents !== 0 };
}

test('new loan without payments is consistent', () => {
  assert.deepEqual(consistency(300, [plan(1, 1, 100), plan(2, 2, 200)]), { estado: 'ACTIVO', saldoFinanciero: 300, totalPlanOperativoPendiente: 300, diferenciaPlan: 0, planRequiereAjuste: false });
});

test('registered payments reduce financial balance using payment.monto', () => {
  assert.deepEqual(consistency(300, [plan(1, 1, 100), plan(2, 2, 200)], [payment(1, 100)]), { estado: 'ACTIVO', saldoFinanciero: 200, totalPlanOperativoPendiente: 200, diferenciaPlan: 0, planRequiereAjuste: false });
});

test('annulled payments do not reduce financial balance or plan pending total', () => {
  assert.deepEqual(consistency(300, [plan(1, 1, 100), plan(2, 2, 200)], [payment(1, 100, 'ANULADO')]), { estado: 'ACTIVO', saldoFinanciero: 300, totalPlanOperativoPendiente: 300, diferenciaPlan: 0, planRequiereAjuste: false });
});

test('partially paid installment is operationally closed after redistribution', () => {
  assert.deepEqual(consistency(300, [plan(1, 1, 100), plan(2, 2, 200)], [payment(1, 40)]), { estado: 'ACTIVO', saldoFinanciero: 260, totalPlanOperativoPendiente: 200, diferenciaPlan: 60, planRequiereAjuste: true });
});

test('partially paid final installment with no future installment leaves plan pending at zero', () => {
  assert.deepEqual(consistency(100, [plan(1, 1, 100)], [payment(1, 40)]), { estado: 'ACTIVO', saldoFinanciero: 60, totalPlanOperativoPendiente: 0, diferenciaPlan: 60, planRequiereAjuste: true });
});

test('capital edit can make the operational plan greater than financial balance', () => {
  assert.deepEqual(consistency(250, [plan(1, 1, 300)]), { estado: 'ACTIVO', saldoFinanciero: 250, totalPlanOperativoPendiente: 300, diferenciaPlan: -50, planRequiereAjuste: true });
});

test('capital edit can make the financial balance greater than the operational plan', () => {
  assert.deepEqual(consistency(350, [plan(1, 1, 300)]), { estado: 'ACTIVO', saldoFinanciero: 350, totalPlanOperativoPendiente: 300, diferenciaPlan: 50, planRequiereAjuste: true });
});

test('interest mismatch is detected through montoTotal', () => {
  assert.deepEqual(consistency(315, [plan(1, 1, 300)]), { estado: 'ACTIVO', saldoFinanciero: 315, totalPlanOperativoPendiente: 300, diferenciaPlan: 15, planRequiereAjuste: true });
});

test('zero, positive, and negative cent differences are classified correctly', () => {
  assert.equal(consistency(100, [plan(1, 1, 100)]).planRequiereAjuste, false);
  assert.equal(consistency(100.01, [plan(1, 1, 100)]).diferenciaPlan, 0.01);
  assert.equal(consistency(99.99, [plan(1, 1, 100)]).diferenciaPlan, -0.01);
});

test('cent comparison does not use floating point equality', () => {
  const result = consistency(100.1, [plan(1, 1, 100.1)]);
  assert.deepEqual([result.diferenciaPlan, result.planRequiereAjuste], [0, false]);
});

test('customized plans can be consistent or mismatched without regenerating them', () => {
  assert.equal(consistency(300, [plan(1, 1, 120), plan(2, 2, 180)]).planRequiereAjuste, false);
  assert.equal(consistency(300, [plan(1, 1, 120), plan(2, 2, 170)]).diferenciaPlan, 10);
});

for (const estado of ['ACTIVO', 'INCOBRABLE', 'REFINANCIADO', 'CANCELADO']) {
  test(`${estado} consistent or settled loan does not produce a false positive`, () => {
    assert.equal(consistency(300, [plan(1, 1, 100), plan(2, 2, 200)], [payment(1, 100), payment(2, 200)], estado).planRequiereAjuste, false);
  });
}

test('annulled payments do not incorrectly change operational pending total', () => {
  const without = consistency(300, [plan(1, 1, 100), plan(2, 2, 200)]);
  const withAnnulled = consistency(300, [plan(1, 1, 100), plan(2, 2, 200)], [payment(1, 100, 'ANULADO')]);
  assert.deepEqual(withAnnulled, without);
});

test('loan detail use case returns the four dynamic consistency fields', async () => {
  const useCase = new ObtenerPrestamoPorIdUseCase(
    { buscarPorId: async () => ({ id: 1, montoTotal: 300, cliente: { id: 1, nombre: 'Client' } }) },
    undefined,
    undefined,
    { buscarPorPrestamoId: async () => [plan(1, 1, 300)] },
    { totalPlanOperativoPendiente: (plans, payments) => getTotalPlanOperativoPendienteCents(plans, getRegisteredPlanPagoTotals(payments)) },
    { listarPorPrestamo: async () => [payment(1, 100)] },
  );
  const result = await useCase.execute(1);
  assert.deepEqual(Object.keys(result).filter((key) => ['saldoFinanciero', 'totalPlanOperativoPendiente', 'diferenciaPlan', 'planRequiereAjuste'].includes(key)), ['saldoFinanciero', 'totalPlanOperativoPendiente', 'diferenciaPlan', 'planRequiereAjuste']);
  const http = response({ ...result, fechaAlta: new Date('2026-09-05T00:00:00.000Z'), cliente: { id: 1, identificacion: '1', nombre: 'Client' }, periodicidadPago: {}, formaPago: {}, formaDesembolso: null });
  assert.deepEqual([http.saldoFinanciero, http.totalPlanOperativoPendiente, http.diferenciaPlan, http.planRequiereAjuste], [200, 0, 200, true]);
});
