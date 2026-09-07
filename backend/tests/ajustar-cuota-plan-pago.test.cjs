const assert = require('node:assert/strict');
const test = require('node:test');
const { BadRequestException } = require('@nestjs/common');
const { AjustarCuotaPlanPagoUseCase } = require('../dist/modules/planes-pago/application/use-cases/ajustar-cuota-plan-pago.use-case');

const plan = (id, numeroPago, montoProgramado, prestamoId = 1) => ({ id, prestamoId, numeroPago, montoProgramado, fechaVencimiento: '2026-09-05', fechaCreacion: new Date() });
const payment = (id, planPagoId, monto) => ({ id, planPagoId, monto });

class FakeDataSource {
  constructor(plans, payments = [], loan = { id: 1, estado: 'ACTIVO', montoTotal: 700 }) { this.plans = plans; this.payments = payments; this.loan = loan; this.failOnSecondSave = false; }
  transaction(callback) {
    const snapshot = this.plans.map((item) => ({ ...item }));
    return Promise.resolve().then(() => callback({ getRepository: (entity) => entity.name === 'PlanPagoOrmEntity' ? this.planRepository() : entity.name === 'PrestamoOrmEntity' ? this.loanRepository() : this.paymentRepository() })).catch((error) => { this.plans.splice(0, this.plans.length, ...snapshot); throw error; });
  }
  planRepository() { let saves = 0; return { findOne: async ({ where }) => this.plans.find((item) => item.id === where.id) ?? null, find: async ({ where }) => this.plans.filter((item) => item.prestamoId === where.prestamoId).sort((a, b) => a.numeroPago - b.numeroPago), save: async (item) => { saves += 1; if (this.failOnSecondSave && saves === 2) throw new Error('second update failed'); return item; } }; }
  loanRepository() { return { findOne: async ({ where }) => where.id === this.loan.id ? this.loan : null }; }
  paymentRepository() { return { find: async ({ where }) => { const value = where.planPagoId; const ids = value?._value ?? [value]; return this.payments.filter((item) => ids.includes(item.planPagoId)); } }; }
}

const execute = (dataSource, id, amount) => new AjustarCuotaPlanPagoUseCase(dataSource).execute(id, { montoProgramado: amount });
const message = (promise, expected) => assert.rejects(promise, (error) => { assert.ok(error instanceof BadRequestException); assert.equal(error.message, expected); return true; });

test('decrease redistributes cents to the next pending installment and preserves the total', async () => {
  const plans = [plan(1, 1, 240), plan(2, 2, 280), plan(3, 3, 180)]; const source = new FakeDataSource(plans, [], { id: 1, estado: 'ACTIVO', montoTotal: 700 });
  await execute(source, 1, 200);
  assert.deepEqual(plans.map((item) => item.montoProgramado), [200, 320, 180]); assert.equal(plans.reduce((sum, item) => sum + Math.round(item.montoProgramado * 100), 0), 70000);
});

test('increase takes cents from the next pending installment', async () => {
  const plans = [plan(1, 1, 240), plan(2, 2, 280)]; const source = new FakeDataSource(plans, [], { id: 1, estado: 'ACTIVO', montoTotal: 520 });
  await execute(source, 1, 300); assert.deepEqual(plans.map((item) => item.montoProgramado), [300, 220]);
});

test('supports two-decimal cent amounts', async () => {
  const plans = [plan(1, 1, 24.01), plan(2, 2, 28.01)]; const source = new FakeDataSource(plans, [], { id: 1, estado: 'ACTIVO', montoTotal: 52.02 });
  await execute(source, 1, 20.02); assert.deepEqual(plans.map((item) => item.montoProgramado), [20.02, 32]);
});

test('rejects paid and partial current installments without touching them', async () => {
  await message(execute(new FakeDataSource([plan(1, 1, 240), plan(2, 2, 280)], [payment(1, 1, 240)], { id: 1, estado: 'ACTIVO', montoTotal: 520 }), 1, 200), 'La cuota ya está PAGADA y no puede ajustarse.');
  await message(execute(new FakeDataSource([plan(1, 1, 240), plan(2, 2, 280)], [payment(1, 1, 1)], { id: 1, estado: 'ACTIVO', montoTotal: 520 }), 1, 200), 'La cuota es PARCIAL y no puede ajustarse.');
});

test('rejects the last installment and a non-positive next installment', async () => {
  await message(execute(new FakeDataSource([plan(1, 1, 240)], [], { id: 1, estado: 'ACTIVO', montoTotal: 240 }), 1, 200), 'No existe una cuota posterior pendiente para redistribuir la diferencia.');
  await message(execute(new FakeDataSource([plan(1, 1, 240), plan(2, 2, 10)], [], { id: 1, estado: 'ACTIVO', montoTotal: 250 }), 1, 251), 'El monto de la cuota posterior debe ser mayor que cero.');
});

test('selects only the first pending installment of the same loan', async () => {
  const plans = [plan(1, 1, 240), plan(2, 2, 280), plan(3, 3, 180, 2)]; const source = new FakeDataSource(plans.slice(0, 2), [], { id: 1, estado: 'ACTIVO', montoTotal: 520 }); source.plans.push(plans[2]);
  await execute(source, 1, 200); assert.equal(plans[1].montoProgramado, 320); assert.equal(plans[2].montoProgramado, 180);
});

test('rejects an inactive loan, keeps payments and rolls back a failed second update', async () => {
  await message(execute(new FakeDataSource([plan(1, 1, 240), plan(2, 2, 280)], [], { id: 1, estado: 'CANCELADO', montoTotal: 520 }), 1, 200), 'Solo se puede ajustar una cuota de un préstamo activo.');
  const plans = [plan(1, 1, 240), plan(2, 2, 280)]; const payments = [payment(1, 99, 7)]; const source = new FakeDataSource(plans, payments, { id: 1, estado: 'ACTIVO', montoTotal: 520 }); source.failOnSecondSave = true;
  await assert.rejects(execute(source, 1, 200)); assert.deepEqual(plans.map((item) => item.montoProgramado), [240, 280]); assert.deepEqual(payments, [payment(1, 99, 7)]);
});
