const assert = require('node:assert/strict');
const test = require('node:test');
const { BadRequestException, NotFoundException } = require('@nestjs/common');
const { PersonalizarPlanPagoUseCase } = require('../dist/modules/planes-pago/application/use-cases/personalizar-plan-pago.use-case');
const { EstadoPago } = require('../dist/modules/pagos/domain/enums/estado-pago.enum');
const { EstadoPrestamo } = require('../dist/modules/prestamos/domain/enums/estado-prestamo.enum');

const entities = { PlanPagoOrmEntity: 'plans', PrestamoOrmEntity: 'loans', PagoOrmEntity: 'payments' };
const clone = (value) => structuredClone(value);
const plan = (id, numeroPago, montoProgramado, fechaVencimiento, prestamoId = 1) => ({ id, prestamoId, numeroPago, montoProgramado, fechaVencimiento, fechaCreacion: new Date() });
const payment = (id, planPagoId, monto, estado = EstadoPago.REGISTRADO) => ({ id, prestamoId: 1, planPagoId, monto, estado, capitalAplicado: monto, interesAplicado: 0 });
const item = (fechaVencimiento, montoProgramado, id) => ({ ...(id === undefined ? {} : { id }), fechaVencimiento, montoProgramado });
const dto = (...items) => ({ cuotas: items });
const dates = ['2026-09-05', '2026-09-12', '2026-09-19', '2026-09-26', '2026-10-03', '2026-10-10'];

class QueryBuilder {
  constructor(store, collection) { this.store = store; this.collection = collection; this.params = {}; }
  where(_sql, params = {}) { Object.assign(this.params, params); return this; }
  orderBy() { return this; }
  addOrderBy() { return this; }
  setLock(mode) { this.store.locks.push({ collection: this.collection, mode }); return this; }
  async getOne() {
    if (this.collection === 'loans') return this.store.working.loans.find((value) => value.id === this.params.id) || null;
    return null;
  }
  async getMany() {
    this.store.queryCounts[this.collection] = (this.store.queryCounts[this.collection] || 0) + 1;
    return this.store.working[this.collection].filter((value) => value.prestamoId === this.params.prestamoId).sort((a, b) => a.numeroPago - b.numeroPago || a.id - b.id);
  }
}

class Repository {
  constructor(store, collection) { this.store = store; this.collection = collection; }
  createQueryBuilder() { return new QueryBuilder(this.store, this.collection); }
  create(value) { return { ...value, id: this.store.nextPlanId++ }; }
  async save(value) {
    const values = Array.isArray(value) ? value : [value];
    if (this.store.failOnSave) throw new Error('simulated persistence failure');
    for (const current of values) {
      const index = this.store.working[this.collection].findIndex((candidate) => candidate.id === current.id);
      if (index >= 0) this.store.working[this.collection][index] = current;
      else this.store.working[this.collection].push(current);
    }
    return value;
  }
  async remove(value) { for (const current of value) this.store.working[this.collection] = this.store.working[this.collection].filter((candidate) => candidate.id !== current.id); }
}

class Store {
  constructor({ plans, payments = [], loan = {}, caja = [] } = {}) {
    this.state = { plans: plans || [], payments, loans: [{ id: 1, estado: EstadoPrestamo.ACTIVO, montoTotal: 300, fechaAlta: '2026-09-01', ...loan }], caja };
    this.nextPlanId = 100;
    this.locks = [];
    this.queryCounts = {};
    this.failOnSave = false;
  }
  async transaction(callback) {
    this.working = clone(this.state);
    try { const result = await callback({ getRepository: (Entity) => new Repository(this, entities[Entity.name]) }); this.state = this.working; return result; }
    finally { this.working = undefined; }
  }
}

const execute = (store, values) => new PersonalizarPlanPagoUseCase(store).execute(1, values);
const assert400 = (promise, message) => assert.rejects(promise, (error) => { assert.ok(error instanceof BadRequestException); if (message) assert.equal(error.message, message); return true; });
const basic = (amounts = [100, 100, 100]) => new Store({ plans: amounts.map((amount, index) => plan(index + 1, index + 1, amount, dates[index])) });
const existingProposal = (amounts) => dto(...amounts.map((amount, index) => item(dates[index], amount, index + 1)));

test('rejects non-active loans', async () => { await assert400(execute(new Store({ plans: [plan(1, 1, 300, dates[0])], loan: { estado: EstadoPrestamo.CANCELADO } }), dto(item(dates[0], 300, 1))), 'Solo se puede personalizar el plan de un préstamo activo.'); });
test('rejects a missing loan', async () => { const store = basic(); await assert.rejects(new PersonalizarPlanPagoUseCase(store).execute(9, dto(item(dates[0], 300, 1))), (error) => error instanceof NotFoundException); });
test('rejects a missing plan', async () => { await assert.rejects(execute(new Store(), dto(item(dates[0], 300))), (error) => error instanceof NotFoundException); });
test('accepts an empty future proposal after total payment', async () => { const store = new Store({ plans: [plan(1, 1, 300, dates[0])], payments: [payment(1, 1, 300)] }); const result = await execute(store, dto()); assert.equal(result.saldoPendiente, 0); assert.equal(result.cuotas[0].protegida, true); });
test('updates an included future installment', async () => { const store = basic(); await execute(store, dto(item(dates[0], 80, 1), item(dates[1], 110, 2), item(dates[2], 110, 3))); assert.equal(store.state.plans[0].montoProgramado, 80); });
test('omitted future installments are deleted', async () => { const store = basic(); await execute(store, dto(item(dates[0], 150, 1), item(dates[1], 150, 2))); assert.deepEqual(store.state.plans.map((value) => value.id), [1, 2]); });
test('missing ids create future installments', async () => { const store = basic(); const newInstallment = item(dates[3], 75); assert.equal(newInstallment.id, undefined); await execute(store, dto(item(dates[0], 75, 1), item(dates[1], 75, 2), item(dates[2], 75, 3), newInstallment)); const created = store.state.plans.find((value) => value.id >= 100); assert.ok(created); assert.equal(created.numeroPago, 4); assert.equal(created.fechaVencimiento, dates[3]); assert.equal(created.montoProgramado, 75); });
test('preserves existing ids and creates a new installment in a mixed proposal', async () => { const store = basic(); const newInstallment = item('2026-10-03', 50); const proposal = dto(item(dates[0], 80, 1), item(dates[1], 100, 2), item(dates[2], 70, 3), newInstallment); assert.equal(newInstallment.id, undefined); await execute(store, proposal); assert.deepEqual(store.state.plans.map((value) => value.id), [1, 2, 3, 100]); assert.equal(store.state.plans[0].id, proposal.cuotas[0].id); assert.equal(store.state.plans[3].fechaVencimiento, newInstallment.fechaVencimiento); });
test('supports a reduction while preserving cents total', async () => { const store = new Store({ plans: [plan(1, 1, 100, dates[0]), plan(2, 2, 100.01, dates[1]), plan(3, 3, 99.99, dates[2])], loan: { montoTotal: 300 } }); await execute(store, existingProposal([90, 110.01, 99.99])); assert.equal(store.state.plans.reduce((sum, value) => sum + Math.round(value.montoProgramado * 100), 0), 30000); });
test('supports an increase while preserving cents total', async () => { const store = basic(); await execute(store, existingProposal([120, 90, 90])); assert.deepEqual(store.state.plans.map((value) => value.montoProgramado), [120, 90, 90]); });
test('accepts an exact sum', async () => { const store = basic(); const result = await execute(store, existingProposal([100, 100, 100])); assert.equal(result.totalPlanOperativoPendiente, 300); });
test('rejects a lower sum', async () => { await assert400(execute(basic(), existingProposal([99, 100, 100]))); });
test('rejects a higher sum', async () => { await assert400(execute(basic(), existingProposal([101, 100, 100]))); });
test('keeps two decimal amounts exact', async () => { const store = new Store({ plans: [plan(1, 1, 50.01, dates[0]), plan(2, 2, 49.99, dates[1])], loan: { montoTotal: 100 } }); const result = await execute(store, existingProposal([49.99, 50.01])); assert.deepEqual(result.cuotas.map((value) => value.montoProgramado), [49.99, 50.01]); });
test('registered payments protect their referenced installment', async () => { const store = new Store({ plans: [plan(1, 1, 100, dates[0]), plan(2, 2, 200, dates[1])], payments: [payment(1, 1, 20)] }); await assert400(execute(store, dto(item(dates[0], 120, 1), item(dates[1], 180, 2)))); assert.equal(store.state.plans[0].montoProgramado, 100); });
test('annulled payments also protect their referenced installment', async () => { const store = new Store({ plans: [plan(1, 1, 100, dates[0]), plan(2, 2, 200, dates[1])], payments: [payment(1, 1, 20, EstadoPago.ANULADO)] }); await assert400(execute(store, dto(item(dates[0], 100, 1), item(dates[1], 200, 2)))); });
test('payments remain immutable and retain planPagoId', async () => { const payments = [payment(1, 1, 20)]; const store = new Store({ plans: [plan(1, 1, 100, dates[0]), plan(2, 2, 200, dates[1])], payments }); await assert400(execute(store, dto(item(dates[0], 120, 1), item(dates[1], 180, 2)))); assert.deepEqual(store.state.payments, payments); });
test('registered balance excludes annulled payments and does not duplicate partial debt', async () => { const store = new Store({ plans: [plan(1, 1, 100, dates[0]), plan(2, 2, 200, dates[1])], payments: [payment(1, 1, 40), payment(2, 1, 10, EstadoPago.ANULADO)], loan: { montoTotal: 300 } }); const result = await execute(store, dto(item(dates[1], 260, 2))); assert.equal(result.saldoPendiente, 260); assert.equal(result.cuotas.length, 2); assert.equal(result.cuotas[0].montoPendiente, 60); });
test('new dates are strictly after the original plan', async () => { await assert400(execute(basic(), dto(item('2026-09-19', 300))), 'Las nuevas cuotas deben tener fechas posteriores al plan original.'); });
test('a date after the loan term is rejected when it breaks chronology', async () => { const store = new Store({ plans: [plan(1, 1, 300, dates[0])], loan: { fechaAlta: '2026-12-31' } }); await assert400(execute(store, dto(item('2027-01-02', 300)))); });
test('supports 3 to 5 installments', async () => { const store = basic(); await execute(store, dto(item(dates[0], 60, 1), item(dates[1], 60, 2), item(dates[2], 60, 3), item(dates[3], 60), item(dates[4], 60))); assert.equal(store.state.plans.length, 5); });
test('supports 30 to 26 installments', async () => { const planDates = []; let cursor = new Date('2027-01-04T00:00:00.000Z'); while (planDates.length < 30) { if (cursor.getUTCDay() !== 0) planDates.push(cursor.toISOString().slice(0, 10)); cursor.setUTCDate(cursor.getUTCDate() + 1); } const store = new Store({ plans: planDates.map((date, index) => plan(index + 1, index + 1, 10, date)), loan: { montoTotal: 300 } }); await execute(store, dto(...planDates.slice(0, 26).map((date, index) => item(date, 300 / 26, index + 1)))); assert.equal(store.state.plans.length, 26); });
test('derives sequential numbers after protected installments', async () => { const store = new Store({ plans: [plan(1, 1, 100, dates[0]), plan(2, 2, 100, dates[1]), plan(3, 3, 100, dates[2])], payments: [payment(1, 1, 100)] }); await execute(store, dto(item(dates[1], 50, 2), item(dates[2], 150, 3))); assert.deepEqual(store.state.plans.map((value) => value.numeroPago), [1, 2, 3]); });
test('rejects non-chronological dates', async () => { await assert400(execute(basic(), dto(item(dates[1], 100, 1), item(dates[0], 100, 2), item(dates[2], 100, 3)))); });
test('rejects Sunday dates', async () => { await assert400(execute(basic(), dto(item('2026-09-06', 100, 1), item(dates[1], 100, 2), item(dates[2], 100, 3)))); });
test('rolls back every plan mutation on persistence failure', async () => { const store = basic(); const before = clone(store.state.plans); store.failOnSave = true; await assert.rejects(execute(store, existingProposal([100, 100, 100]))); assert.deepEqual(store.state.plans, before); });
test('does not touch Caja', async () => { const store = new Store({ plans: [plan(1, 1, 300, dates[0])], caja: [{ id: 1, monto: 300 }] }); const before = clone(store.state.caja); await execute(store, existingProposal([300])); assert.deepEqual(store.state.caja, before); });
test('uses one bulk query for payments and one for plans', async () => { const store = basic(); await execute(store, existingProposal([100, 100, 100])); assert.equal(store.queryCounts.payments, 1); assert.equal(store.queryCounts.plans, 1); });
test('locks loan, plan, and payments', async () => { const store = basic(); await execute(store, existingProposal([100, 100, 100])); assert.deepEqual(store.locks.map((value) => value.mode), ['pessimistic_write', 'pessimistic_write', 'pessimistic_write']); });
test('returns an enriched response', async () => { const store = new Store({ plans: [plan(1, 1, 100, dates[0]), plan(2, 2, 200, dates[1])], payments: [payment(1, 1, 40)] }); const result = await execute(store, dto(item(dates[1], 260, 2))); assert.deepEqual(Object.keys(result.cuotas[0]).sort(), ['editable', 'eliminable', 'estado', 'fechaVencimiento', 'id', 'montoPagado', 'montoPendiente', 'montoProgramado', 'numeroPago', 'protegida']); });
test('rejects repeated ids', async () => { await assert400(execute(basic(), dto(item(dates[0], 100, 1), item(dates[1], 100, 1), item(dates[2], 100, 3)))); });
test('rejects ids from another loan', async () => { await assert400(execute(basic(), dto(item(dates[0], 300, 999))), 'La cuota no pertenece al préstamo.'); });
