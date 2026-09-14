const assert = require('node:assert/strict');
const test = require('node:test');
const { ListarPlanPagoUseCase } = require('../dist/modules/planes-pago/application/use-cases/listar-plan-pago.use-case');
const { EstadoPago } = require('../dist/modules/pagos/domain/enums/estado-pago.enum');
const { EstadoPrestamo } = require('../dist/modules/prestamos/domain/enums/estado-prestamo.enum');

const plan = (id, numeroPago, montoProgramado = 100) => ({ id, prestamoId: 1, numeroPago, montoProgramado, fechaVencimiento: new Date(`2026-09-${String(5 + numeroPago * 7).padStart(2, '0')}T00:00:00.000Z`), fechaCreacion: new Date() });
const payment = (planPagoId, estado = EstadoPago.REGISTRADO, monto = 40, fecha = new Date('2026-09-05T00:00:00.000Z')) => ({ planPagoId, estado, monto, fecha });

const execute = async (estado, payments = []) => {
  let bulkQueries = 0;
  const plans = [plan(1, 1), plan(2, 2), plan(3, 3)];
  const editability = {
    async listarPagos() { bulkQueries += 1; return payments; },
    protectedIds(values) { return new Set(values.filter((value) => value.planPagoId != null).map((value) => value.planPagoId)); },
    registeredTotals(values) { const result = new Map(); for (const value of values) if (value.estado === EstadoPago.REGISTRADO && value.planPagoId != null) result.set(value.planPagoId, value.monto * 100); return result; },
    calcularFlags(numeroPago, protectedIds, id, loanState, lastProtectedNumber) { const protegida = protectedIds.has(id); const editable = loanState === EstadoPrestamo.ACTIVO && !protegida && numeroPago > lastProtectedNumber; return { protegida, editable, eliminable: editable }; },
  };
  const result = await new ListarPlanPagoUseCase({ buscarPorPrestamoId: async () => plans }, { findOne: async () => ({ id: 1, estado }) }, editability).execute(1);
  return { result, bulkQueries };
};

test('future installment without payments is editable and eliminable', async () => { const { result } = await execute(EstadoPrestamo.ACTIVO); assert.deepEqual([result[0].editable, result[0].eliminable], [true, true]); });
test('registered payment protects its installment', async () => { const { result } = await execute(EstadoPrestamo.ACTIVO, [payment(1)]); assert.deepEqual([result[0].protegida, result[0].editable, result[0].eliminable], [true, false, false]); });
test('annulled payment also protects its installment', async () => { const { result } = await execute(EstadoPrestamo.ACTIVO, [payment(1, EstadoPago.ANULADO)]); assert.deepEqual([result[0].protegida, result[0].editable, result[0].eliminable], [true, false, false]); });
test('any registered payment closes and protects its installment', async () => { const { result } = await execute(EstadoPrestamo.ACTIVO, [payment(1, EstadoPago.REGISTRADO, 40)]); assert.deepEqual([result[0].estado, result[0].montoPagado, result[0].montoPendiente, result[0].protegida], ['PAGADA', 40, 0, true]); });
test('annulled payment does not count as received but still protects its installment', async () => { const { result } = await execute(EstadoPrestamo.ACTIVO, [payment(1, EstadoPago.ANULADO, 40)]); assert.deepEqual([result[0].estado, result[0].montoPagado, result[0].montoPendiente, result[0].protegida], ['PENDIENTE', 0, 100, true]); });
test('next future installment remains editable after a registered payment', async () => { const { result } = await execute(EstadoPrestamo.ACTIVO, [payment(1)]); assert.deepEqual([result[1].editable, result[1].eliminable], [true, true]); });
for (const estado of [EstadoPrestamo.CANCELADO, EstadoPrestamo.REFINANCIADO, EstadoPrestamo.INCOBRABLE]) {
  test(`${estado.toLowerCase()} loan cannot edit or delete future installments`, async () => { const { result } = await execute(estado); assert.deepEqual([result[0].editable, result[0].eliminable], [false, false]); });
}
test('payment references are resolved with one bulk query', async () => { const { bulkQueries } = await execute(EstadoPrestamo.ACTIVO, [payment(1), payment(2, EstadoPago.ANULADO)]); assert.equal(bulkQueries, 1); });
test('GET keeps the array envelope and existing fields', async () => { const { result } = await execute(EstadoPrestamo.ACTIVO); assert.ok(Array.isArray(result)); assert.deepEqual(Object.keys(result[0]).sort(), ['editable', 'eliminable', 'estado', 'fechaCreacion', 'fechaVencimiento', 'fechasPago', 'id', 'montoPagado', 'montoPendiente', 'montoProgramado', 'numeroPago', 'prestamoId', 'protegida'].sort()); });
test('GET handles Date payment dates without changing the calendar day', async () => { const { result } = await execute(EstadoPrestamo.ACTIVO, [payment(1, EstadoPago.REGISTRADO, 40, new Date('2026-09-05T23:30:00.000-05:00'))]); assert.deepEqual(result[0].fechasPago, ['2026-09-06']); });
test('GET handles PostgreSQL DATE strings and ISO strings without timezone shifting', async () => {
  const datePayment = await execute(EstadoPrestamo.ACTIVO, [payment(1, EstadoPago.REGISTRADO, 40, '2026-09-05')]);
  const isoPayment = await execute(EstadoPrestamo.ACTIVO, [payment(1, EstadoPago.REGISTRADO, 40, '2026-09-05T23:30:00.000-05:00')]);
  assert.deepEqual(datePayment.result[0].fechasPago, ['2026-09-05']);
  assert.deepEqual(isoPayment.result[0].fechasPago, ['2026-09-05']);
});
