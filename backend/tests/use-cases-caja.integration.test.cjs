const assert = require('node:assert/strict');
const test = require('node:test');

const { RegistrarPagoUseCase } = require('../dist/modules/pagos/application/use-cases/registrar-pago.use-case');
const { CrearPrestamoUseCase } = require('../dist/modules/prestamos/application/use-cases/crear-prestamo.use-case');
const { CrearRefinanciamientoUseCase } = require('../dist/modules/refinanciamientos/application/use-cases/crear-refinanciamiento.use-case');
const { MovimientoCajaService } = require('../dist/modules/movimientos-caja/application/services/movimiento-caja.service');
const { MovimientoCaja } = require('../dist/modules/movimientos-caja/domain/entities/movimiento-caja');
const { ConceptoMovimientoCaja: C } = require('../dist/modules/movimientos-caja/domain/enums/concepto-movimiento-caja.enum');
const { TipoMovimientoCaja: T } = require('../dist/modules/movimientos-caja/domain/enums/tipo-movimiento-caja.enum');
const { EstadoPrestamo: E } = require('../dist/modules/prestamos/domain/enums/estado-prestamo.enum');
const { authenticatedUserId } = require('../dist/common/authenticated-user');
const { MovimientoCajaOrmEntity } = require('../dist/modules/movimientos-caja/infrastructure/persistence/typeorm/movimiento-caja.orm-entity');
const { getMetadataArgsStorage } = require('typeorm');

const entityNames = {
  PrestamoOrmEntity: 'prestamos',
  PagoOrmEntity: 'pagos',
  RefinanciamientoOrmEntity: 'refinanciamientos',
  PlanPagoOrmEntity: 'planes',
  ClienteOrmEntity: 'clientes',
  PeriodicidadPagoOrmEntity: 'periodicidades',
  FormaPagoOrmEntity: 'formas',
};

class TransactionalStore {
  constructor(seed = {}) {
    this.state = {
      prestamos: (seed.prestamos || []).map((loan) => ({ ...loan, montoTotal: loan.montoTotal ?? loan.capital + loan.interes })), pagos: seed.pagos || [], refinanciamientos: [],
      planes: seed.planes || [], movimientos: [], clientes: [{ id: 1, activo: true, identificacion: 'C-1' }],
      periodicidades: [{ id: 1, activo: true, nombre: 'MENSUAL' }],
      formas: [{ id: 1, activo: true, nombre: 'EFECTIVO' }],
    };
    this.next = { prestamos: 10, pagos: 20, refinanciamientos: 30, planes: 40, movimientos: 50 };
    this.managers = [];
  }

  async transaction(callback) {
    const working = clone(this.state);
    const manager = new FakeManager(working, this);
    this.managers.push(manager);
    try {
      const result = await callback(manager);
      this.state = working;
      return result;
    } catch (error) {
      throw error;
    }
  }
}

class FakeManager {
  constructor(state, store) { this.state = state; this.store = store; }
  getRepository(Entity) {
    const collection = entityNames[Entity.name];
    if (!collection) throw new Error(`Unexpected repository: ${Entity.name}`);
    return new FakeRepository(this.state, this.store, collection);
  }
}

class FakeRepository {
  constructor(state, store, collection) { this.state = state; this.store = store; this.collection = collection; }
  save(value) {
    if (Array.isArray(value)) return Promise.all(value.map(item => this.save(item)));
    if (value.id == null) value.id = this.store.next[this.collection]++;
    const index = this.state[this.collection].findIndex(item => item.id === value.id);
    if (index < 0) this.state[this.collection].push(value);
    else this.state[this.collection][index] = value;
    return Promise.resolve(value);
  }
  count({ where }) { return Promise.resolve(this.state[this.collection].filter(item => item.prestamoOrigenId === where.prestamoOrigenId).length); }
  findOne({ where }) { return Promise.resolve(this.state[this.collection].find(item => item.id === where.id) || null); }
  createQueryBuilder() { return new FakeQueryBuilder(this.state, this.collection, this); }
}

class FakeQueryBuilder {
  constructor(state, collection, repository) { this.state = state; this.collection = collection; this.repository = repository; this.id = null; this.prestamoId = null; this.aggregate = false; }
  leftJoinAndSelect() { return this; }
  where(_sql, params) { this.id = params?.id; this.prestamoId = params?.prestamoId ?? this.prestamoId; return this; }
  andWhere() { return this; }
  orderBy() { return this; }
  setLock() { return this; }
  select() { this.aggregate = true; return this; }
  addSelect() { this.aggregate = true; return this; }
  async getRawOne() {
    const rows = this.state.pagos.filter(item => item.prestamoId === this.id);
    return { total: String(rows.reduce((sum, row) => sum + row.monto, 0)), capital: String(rows.reduce((sum, row) => sum + row.capitalAplicado, 0)), interes: String(rows.reduce((sum, row) => sum + row.interesAplicado, 0)) };
  }
  async getMany() { return this.state[this.collection].filter(item => this.prestamoId == null || item.prestamoId === this.prestamoId); }
  async getOne() {
    const item = this.state[this.collection].find(value => value.id === this.id) || null;
    if (!item) return null;
    if (this.collection === 'pagos') return Object.assign(item, { formaPago: { id: 1, nombre: 'EFECTIVO' }, cobrador: { id: item.cobradorId }, prestamo: this.state.prestamos.find(value => value.id === item.prestamoId) });
    if (this.collection === 'prestamos') return Object.assign(item, { cliente: this.state.clientes.find(value => value.id === item.clienteId), periodicidadPago: this.state.periodicidades.find(value => value.id === item.periodicidadPagoId), formaPago: this.state.formas.find(value => value.id === item.formaPagoId) });
    return item;
  }
}

class FakeUsers {
  async buscarPorIdEnTransaccion() { return { id: 1, activo: true }; }
}

class FakeForms {
  async buscarPorIdEnTransaccion() { return { id: 1, activo: true }; }
}

class FakeReferences {
  async validarEnTransaccion() { return { periodicidadPago: { id: 1, nombre: 'MENSUAL' }, formaPago: { id: 1, nombre: 'EFECTIVO' } }; }
}

function loanRepository(store) {
  return { buscarPorId: async id => store.state.prestamos.find(value => value.id === id) || null };
}

function planRepository(store, options = {}) {
  return {
    guardarMuchosEnTransaccion: async (manager, plans) => {
      if (options.fail) throw new Error('plan failure');
      for (const plan of plans) await manager.getRepository({ name: 'PlanPagoOrmEntity' }).save(plan);
      return plans;
    },
  };
}

function clone(value) { return structuredClone(value); }
function dtoLoan(capital = 500000, interes = 100000) { return { clienteId: 1, periodicidadPagoId: 1, formaPagoId: 1, fechaAlta: '2026-08-31', capital, interes, cantidadPagos: 12, planPersonalizado: false }; }
function dtoRefinance(montoNuevoDesembolsado) { return { prestamoOrigenId: 1, periodicidadPagoId: 1, formaPagoId: 1, fecha: '2026-08-31', montoNuevoDesembolsado, interesNuevo: 0, cantidadPagos: 12, planPersonalizado: false }; }
function paymentPlan(montoProgramado) { return [{ id: 40, prestamoId: 1, numeroPago: 1, montoProgramado }]; }
function cajaFor(store, options = {}) {
  const repo = {
    guardarEnTransaccion: async (manager, value) => {
      if (options.fail) throw new Error('cash failure');
      value.id = store.next.movimientos++;
      manager.state.movimientos.push(value);
      store.lastMovementManager = manager;
      return value;
    },
    buscarPorPagoYConceptoEnTransaccion: async (manager, id, concept) => manager.state.movimientos.find(v => v.pagoId === id && v.concepto === concept) || null,
    buscarPorRefinanciamientoYConceptoEnTransaccion: async (manager, id, concept) => manager.state.movimientos.find(v => v.refinanciamientoId === id && v.concepto === concept) || null,
    buscarPorPrestamoYConceptoEnTransaccion: async (manager, id, concept) => manager.state.movimientos.find(v => v.prestamoId === id && v.concepto === concept) || null,
  };
  return new MovimientoCajaService(repo, new FakeUsers());
}

function fakeCashRepository() {
  const items = [];
  return {
    items,
    users: new FakeUsers(),
    repo: {
      guardarEnTransaccion: async (_manager, value) => { items.push(value); return value; },
      buscarPorPagoYConceptoEnTransaccion: async (_manager, pagoId, concepto) => items.find(value => value.pagoId === pagoId && value.concepto === concepto) || null,
      buscarPorRefinanciamientoYConceptoEnTransaccion: async () => null,
      buscarPorPrestamoYConceptoEnTransaccion: async () => null,
    },
  };
}

test('payment records PAGO_CLIENTE in the same manager and rolls back on cash failure', async () => {
  const store = new TransactionalStore({ prestamos: [{ id: 1, clienteId: 1, capital: 50000, interes: 0, estado: E.ACTIVO }], planes: paymentPlan(50000) });
  const caja = cajaFor(store);
  const useCase = new RegistrarPagoUseCase(store, new FakeForms(), new FakeUsers(), caja);
  await useCase.execute({ prestamoId: 1, planPagoId: 40, formaPagoId: 1, monto: 50000, cobradorId: 5, fecha: '2026-08-31' }, 3);
  assert.deepEqual(store.state.movimientos.map(v => [v.tipo, v.concepto, v.monto]), [[T.ENTRADA, C.PAGO_CLIENTE, 50000]]);
  assert.equal(store.state.pagos[0].cobradorId, 5);
  assert.equal(store.state.movimientos[0].usuarioId, 3);
  assert.equal(store.lastMovementManager, store.managers[0]);

  const failingStore = new TransactionalStore({ prestamos: [{ id: 1, clienteId: 1, capital: 50000, interes: 0, estado: E.ACTIVO }], planes: paymentPlan(50000) });
  await assert.rejects(() => new RegistrarPagoUseCase(failingStore, new FakeForms(), new FakeUsers(), cajaFor(failingStore, { fail: true })).execute({ prestamoId: 1, planPagoId: 40, formaPagoId: 1, monto: 50000, cobradorId: 5, fecha: '2026-08-31' }, 3), /cash failure/);
  assert.equal(failingStore.state.pagos.length, 0);
  assert.equal(failingStore.state.movimientos.length, 0);
});

test('payment movement preserves SINPE and EFECTIVO formaPagoId', async () => {
  for (const formaPagoId of [1, 2]) {
    const store = new TransactionalStore({ prestamos: [{ id: 1, clienteId: 1, capital: 50000, interes: 0, estado: E.ACTIVO }], planes: paymentPlan(50000) });
    store.state.formas.push({ id: 2, activo: true, nombre: 'SINPE' });
    await new RegistrarPagoUseCase(store, new FakeForms(), new FakeUsers(), cajaFor(store)).execute({ prestamoId: 1, planPagoId: 40, formaPagoId, monto: 50000, cobradorId: 5, fecha: '2026-08-31' }, 3);
    assert.equal(store.state.movimientos.length, 1);
    assert.equal(store.state.movimientos[0].concepto, C.PAGO_CLIENTE);
    assert.equal(store.state.movimientos[0].formaPagoId, formaPagoId);
  }
});

test('P1/P2/P3/P7 payment evidence is explicit and exact', async () => {
  const store = new TransactionalStore({ prestamos: [{ id: 1, clienteId: 1, capital: 30000, interes: 20000, estado: E.ACTIVO }], planes: paymentPlan(50000) });
  const payment = await new RegistrarPagoUseCase(store, new FakeForms(), new FakeUsers(), cajaFor(store)).execute({ prestamoId: 1, planPagoId: 40, formaPagoId: 1, monto: 50000, cobradorId: 5, fecha: '2026-08-31' }, 3);
  const movement = store.state.movimientos;

  assert.equal(movement.length, 1, 'P1: one cash entry only');
  assert.deepEqual(movement.map(value => [value.tipo, value.concepto, value.monto]), [[T.ENTRADA, C.PAGO_CLIENTE, 50000]]);
  assert.deepEqual({ capitalAplicado: payment.capitalAplicado, interesAplicado: payment.interesAplicado }, { capitalAplicado: 30000, interesAplicado: 20000 });
  assert.deepEqual({ fecha: payment.fecha.toISOString(), monto: payment.monto, pagoId: movement[0].pagoId, prestamoId: movement[0].prestamoId, usuarioId: movement[0].usuarioId }, { fecha: '2026-08-31T00:00:00.000Z', monto: 50000, pagoId: payment.id, prestamoId: 1, usuarioId: 3 });
  assert.equal(payment.cobradorId, 5);
});

test('payment cash failure rolls back cancellation after capital and interest are fully covered', async () => {
  const store = new TransactionalStore({ prestamos: [{ id: 1, clienteId: 1, capital: 50000, interes: 10000, estado: E.ACTIVO }], planes: paymentPlan(60000) });
  await assert.rejects(() => new RegistrarPagoUseCase(store, new FakeForms(), new FakeUsers(), cajaFor(store, { fail: true })).execute({ prestamoId: 1, planPagoId: 40, formaPagoId: 1, monto: 60000, cobradorId: 5, fecha: '2026-08-31' }, 3), /cash failure/);
  assert.equal(store.state.prestamos[0].estado, E.ACTIVO);
  assert.equal(store.state.pagos.length, 0);
  assert.equal(store.state.movimientos.length, 0);
});

test('P6 payment cash idempotency contract rejects the second movement for one payment', async () => {
  const f = fakeCashRepository();
  const service = new MovimientoCajaService(f.repo, f.users);
  const first = MovimientoCaja.crear({ tipo: T.ENTRADA, concepto: C.PAGO_CLIENTE, monto: 50000, fecha: new Date(), pagoId: 7, prestamoId: 1, usuarioId: 3 });
  f.items.push(first);
  await assert.rejects(() => service.automatico({}, { tipo: T.ENTRADA, concepto: C.PAGO_CLIENTE, monto: 50000, fecha: new Date(), pagoId: 7, prestamoId: 1, usuarioId: 3 }), /ya existe/);
  const index = getMetadataArgsStorage().indices.find(value => value.target === MovimientoCajaOrmEntity && value.name === 'UQ_movimiento_caja_pago_cliente');
  assert.equal(index?.unique, true);
  assert.match(index?.where || '', /PAGO_CLIENTE/);
  assert.match(index?.where || '', /pago_id/);
});

test('mixed payment applies capital first and records exactly one total movement', async () => {
  const store = new TransactionalStore({ prestamos: [{ id: 1, clienteId: 1, capital: 100, interes: 50, estado: E.ACTIVO }], planes: paymentPlan(150) });
  const useCase = new RegistrarPagoUseCase(store, new FakeForms(), new FakeUsers(), cajaFor(store));

  const first = await useCase.execute({ prestamoId: 1, planPagoId: 40, formaPagoId: 1, monto: 120, cobradorId: 1, fecha: '2026-08-31' }, 1);
  assert.deepEqual({ monto: first.monto, capitalAplicado: first.capitalAplicado, interesAplicado: first.interesAplicado }, { monto: 120, capitalAplicado: 100, interesAplicado: 20 });
  assert.equal(store.state.movimientos.length, 1);
  assert.equal(store.state.movimientos[0].monto, 120);
  assert.equal(store.state.prestamos[0].estado, E.ACTIVO);

  const second = await useCase.execute({ prestamoId: 1, planPagoId: 40, formaPagoId: 1, monto: 30, cobradorId: 1, fecha: '2026-08-31' }, 1);
  assert.deepEqual({ capitalAplicado: second.capitalAplicado, interesAplicado: second.interesAplicado }, { capitalAplicado: 0, interesAplicado: 30 });
  assert.equal(store.state.movimientos.length, 2);
  assert.equal(store.state.prestamos[0].estado, E.CANCELADO);
});

test('loan records a 500000 disbursement and rolls back when cash fails', async () => {
  const store = new TransactionalStore();
  const result = await new CrearPrestamoUseCase(loanRepository(store), new FakeReferences(), store, cajaFor(store), planRepository(store)).execute(dtoLoan(), 3);
  assert.equal(result.id, 10);
  assert.deepEqual(store.state.movimientos.map(v => [v.tipo, v.concepto, v.monto]), [[T.SALIDA, C.DESEMBOLSO_PRESTAMO, 500000]]);
  assert.equal(store.state.movimientos[0].usuarioId, 3);
  assert.equal(store.lastMovementManager, store.managers[0]);
  const failingStore = new TransactionalStore();
  await assert.rejects(() => new CrearPrestamoUseCase(loanRepository(failingStore), new FakeReferences(), failingStore, cajaFor(failingStore, { fail: true }), planRepository(failingStore)).execute(dtoLoan(), 3), /cash failure/);
  assert.equal(failingStore.state.prestamos.length, 0);
  assert.equal(failingStore.state.movimientos.length, 0);
});

test('loan persists the generated plan atomically and rolls back when plan generation fails', async () => {
  const store = new TransactionalStore();
  await new CrearPrestamoUseCase(loanRepository(store), new FakeReferences(), store, cajaFor(store), planRepository(store)).execute(dtoLoan(), 3);
  assert.equal(store.state.planes.length, 12);
  assert.equal(store.state.planes.reduce((sum, plan) => sum + plan.montoProgramado, 0), 600000);

  const failingStore = new TransactionalStore();
  await assert.rejects(() => new CrearPrestamoUseCase(loanRepository(failingStore), new FakeReferences(), failingStore, cajaFor(failingStore), planRepository(failingStore, { fail: true })).execute(dtoLoan(), 3), /plan failure/);
  assert.equal(failingStore.state.prestamos.length, 0);
  assert.equal(failingStore.state.planes.length, 0);
  assert.equal(failingStore.state.movimientos.length, 0);
});

test('personalized loan accepts validated installments and persists them before disbursement', async () => {
  const store = new TransactionalStore();
  const dto = { ...dtoLoan(100000, 20000), cantidadPagos: 2, planPersonalizado: true, cuotas: [
    { numeroPago: 1, fechaVencimiento: '2026-09-01', montoProgramado: 70000 },
    { numeroPago: 2, fechaVencimiento: '2026-09-15', montoProgramado: 50000 },
  ] };
  await new CrearPrestamoUseCase(loanRepository(store), new FakeReferences(), store, cajaFor(store), planRepository(store)).execute(dto, 3);
  assert.deepEqual(store.state.planes.map(plan => plan.montoProgramado), [70000, 50000]);
  assert.deepEqual(store.state.movimientos.map(value => value.concepto), [C.DESEMBOLSO_PRESTAMO]);
});

test('refinancing without new money does not call cash, while 300000 creates only refinancing disbursement', async () => {
  for (const amount of [0, 300000]) {
    const store = new TransactionalStore({ prestamos: [{ id: 1, clienteId: 1, capital: 700000, interes: 100000, estado: E.ACTIVO }] });
    let calls = 0;
    const realCaja = cajaFor(store);
    const caja = { validarActor: (...args) => realCaja.validarActor(...args), automatico: (...args) => { calls++; return realCaja.automatico(...args); } };
    await new CrearRefinanciamientoUseCase(store, caja).execute(dtoRefinance(amount), 3);
    assert.equal(calls, amount ? 1 : 0);
    assert.deepEqual(store.state.movimientos.map(v => [v.tipo, v.concepto, v.monto]), amount ? [[T.SALIDA, C.DESEMBOLSO_REFINANCIAMIENTO, 300000]] : []);
    if (amount) assert.equal(store.state.movimientos[0].usuarioId, 3);
    if (amount) assert.equal(store.lastMovementManager, store.managers[0]);
    assert.equal(store.state.movimientos.some(v => v.concepto === C.DESEMBOLSO_PRESTAMO), false);
  }
});

test('refinancing cash failure rolls back new loan, plan, origin status, and relation', async () => {
  const store = new TransactionalStore({ prestamos: [{ id: 1, clienteId: 1, capital: 700000, interes: 100000, estado: E.ACTIVO }] });
  await assert.rejects(() => new CrearRefinanciamientoUseCase(store, cajaFor(store, { fail: true })).execute(dtoRefinance(300000), 3), /cash failure/);
  assert.equal(store.state.prestamos.length, 1);
  assert.equal(store.state.prestamos[0].estado, E.ACTIVO);
  assert.equal(store.state.refinanciamientos.length, 0);
  assert.equal(store.state.planes.length, 0);
  assert.equal(store.state.movimientos.length, 0);
});

test('authenticated user comes from request.user; headers do not participate', () => {
  assert.equal(authenticatedUserId({ user: { id: '7', sub: '99' }, headers: { 'x-actor-user-id': '5' } }), 7);
  assert.throws(() => authenticatedUserId({ user: { sub: '7' }, headers: { 'x-actor-user-id': '99' } }), /identidad autenticada/);
  assert.throws(() => authenticatedUserId({ headers: { 'x-actor-user-id': '99' } }), /identidad autenticada/);
});
