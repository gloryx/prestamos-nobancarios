const assert = require('node:assert/strict');
const test = require('node:test');
const { AnularPagoUseCase } = require('../dist/modules/pagos/application/use-cases/anular-pago.use-case');
const { PagosController } = require('../dist/modules/pagos/presentation/controllers/pagos.controller');
const { RolesGuard } = require('../dist/modules/auth/roles.guard');
const { ROLES_KEY } = require('../dist/modules/auth/auth.constants');
const { RolUsuario } = require('../dist/modules/usuarios/domain/enums/rol-usuario.enum');
const { EstadoPago } = require('../dist/modules/pagos/domain/enums/estado-pago.enum');
const { EstadoPrestamo } = require('../dist/modules/prestamos/domain/enums/estado-prestamo.enum');
const { MotivoAnulacionPago } = require('../dist/modules/pagos/domain/enums/motivo-anulacion-pago.enum');
const { ConceptoMovimientoCaja } = require('../dist/modules/movimientos-caja/domain/enums/concepto-movimiento-caja.enum');
const { TipoMovimientoCaja } = require('../dist/modules/movimientos-caja/domain/enums/tipo-movimiento-caja.enum');
const { AnularPagoDto } = require('../dist/modules/pagos/application/dto/anular-pago.dto');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');

const entities = { PagoOrmEntity: 'pagos', PagoAnulacionOrmEntity: 'anulaciones', PrestamoOrmEntity: 'prestamos', PlanPagoOrmEntity: 'planes', RefinanciamientoOrmEntity: 'refinanciamientos' };
const clone = value => structuredClone(value);

class Store {
  constructor(seed = {}) {
    this.state = {
      prestamos: seed.prestamos || [{ id: 1, montoTotal: 300, capital: 250, interes: 50, cantidadPagos: 3, estado: EstadoPrestamo.ACTIVO }],
      pagos: seed.pagos || [], anulaciones: seed.anulaciones || [], planes: seed.planes || defaultPlans(), refinanciamientos: seed.refinanciamientos || [], movimientos: seed.movimientos || [],
    };
    this.failPaymentSave = seed.failPaymentSave === true;
    this.next = { movimientos: 100 };
    this.events = [];
  }
  async transaction(callback) {
    const working = clone(this.state);
    const manager = new Manager(working, this);
    try { const result = await callback(manager); this.state = working; return result; } catch (error) { throw error; }
  }
}

class Manager {
  constructor(state, store) { this.state = state; this.store = store; }
  getRepository(Entity) { return new Repository(this.state, this.store, entities[Entity.name]); }
}

class Repository {
  constructor(state, store, collection) { this.state = state; this.store = store; this.collection = collection; }
  save(value) { if (this.collection === 'pagos' && this.store.failPaymentSave) return Promise.reject(new Error('payment persistence failure')); const index = this.state[this.collection].findIndex(item => item.id === value.id); if (index >= 0) this.state[this.collection][index] = value; else this.state[this.collection].push(value); return Promise.resolve(value); }
  createQueryBuilder(alias) { return new QueryBuilder(this.state, this.store, this.collection, alias); }
}

class QueryBuilder {
  constructor(state, store, collection, alias) { this.state = state; this.store = store; this.collection = collection; this.alias = alias; this.sql = ''; this.params = {}; this.locked = false; }
  where(sql, params = {}) { this.sql = sql; Object.assign(this.params, params); return this; }
  andWhere(sql, params = {}) { this.sql += ` ${sql}`; Object.assign(this.params, params); return this; }
  orderBy() { return this; }
  setLock(mode) { this.locked = mode; this.store.events.push({ collection: this.collection, mode }); return this; }
  select() { return this; }
  addSelect() { return this; }
  async getOne() {
    if (this.collection === 'prestamos') return this.state.prestamos.find(value => value.id === this.params.id) || null;
    if (this.collection === 'refinanciamientos') return this.state.refinanciamientos.find(value => value.prestamoOrigenId === this.params.loanId) || null;
    if (this.collection === 'planes') return null;
    if (this.collection === 'pagos') {
      let rows = this.state.pagos.filter(value => value.id === this.params.id);
      if (this.sql.includes('pago.prestamo_id') && this.params.loanId !== undefined) rows = this.state.pagos.filter(value => value.prestamoId === this.params.loanId && value.estado === EstadoPago.REGISTRADO && (value.fecha > this.params.fecha || (value.fecha === this.params.fecha && value.id > this.params.id)));
      const value = rows[0];
      if (!value) return null;
      return value;
    }
    return null;
  }
  async getMany() {
    if (this.collection !== 'planes') return this.state[this.collection];
    return this.state.planes.filter(value => value.prestamoId === this.params.loanId).sort((a, b) => a.numeroPago - b.numeroPago);
  }
  async getRawOne() {
    const rows = this.state.pagos.filter(value => value.prestamoId === this.params.loanId && value.estado === EstadoPago.REGISTRADO);
    return { total: String(rows.reduce((sum, value) => sum + value.monto, 0)), capital: String(rows.reduce((sum, value) => sum + value.capitalAplicado, 0)), interes: String(rows.reduce((sum, value) => sum + value.interesAplicado, 0)) };
  }
}

function defaultPlans() { return [1, 2, 3].map(numeroPago => ({ id: numeroPago, prestamoId: 1, numeroPago, fechaVencimiento: `2026-0${numeroPago}-15`, montoProgramado: 100 })); }
function payment(id, overrides = {}) { return { id, prestamoId: 1, planPagoId: id, monto: 100, capitalAplicado: 80, interesAplicado: 20, fecha: `2026-0${id}-01`, estado: EstadoPago.REGISTRADO, redistribuyoPlan: false, ...overrides }; }

function cashFor(store, { fail = false } = {}) {
  return { async reversarPagoCliente(manager, pagoId, fecha, observaciones, usuarioId) {
    if (fail) throw new Error('cash failure');
    const original = manager.state.movimientos.find(value => value.pagoId === pagoId && value.concepto === ConceptoMovimientoCaja.PAGO_CLIENTE);
    if (!original) throw new Error('original movement missing');
    if (manager.state.movimientos.some(value => value.movimientoReversadoId === original.id)) throw new Error('already reversed');
    const reversal = { id: store.next.movimientos++, tipo: TipoMovimientoCaja.SALIDA, concepto: ConceptoMovimientoCaja.REVERSO, monto: original.monto, fecha, observaciones, pagoId, prestamoId: original.prestamoId, movimientoReversadoId: original.id, usuarioId };
    manager.state.movimientos.push(reversal); return reversal;
  } };
}
const history = { registrar: async () => undefined };
const dto = { motivo: MotivoAnulacionPago.OTRO, observacion: 'Correction' };
const audit = { guardarEnTransaccion: async (manager, value) => { if (manager.state.anulaciones.some(item => item.pagoId === value.pagoId)) throw new Error('duplicate audit'); const saved = { ...value, id: manager.state.anulaciones.length + 1 }; manager.state.anulaciones.push(saved); return saved; } };
function useCase(store, options = {}) { return new AnularPagoUseCase(store, cashFor(store, options), options.history || history, audit); }
function originalMovement(id, amount = 100) { return { id, tipo: TipoMovimientoCaja.ENTRADA, concepto: ConceptoMovimientoCaja.PAGO_CLIENTE, monto: amount, pagoId: id, prestamoId: 1 }; }

test('cancellation endpoint metadata allows ADMINISTRADOR only and RolesGuard denies VENDEDOR', () => {
  const method = PagosController.prototype.anularPago;
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, method), [RolUsuario.ADMINISTRADOR]);
  const reflector = { getAllAndOverride: () => [RolUsuario.ADMINISTRADOR] };
  const guard = new RolesGuard(reflector);
  const context = role => ({ getHandler: () => method, getClass: () => PagosController, switchToHttp: () => ({ getRequest: () => ({ user: { rol: role } }) }) });
  assert.equal(guard.canActivate(context(RolUsuario.ADMINISTRADOR)), true);
  assert.throws(() => guard.canActivate(context(RolUsuario.VENDEDOR)), /permisos/);
});

test('OTRO requires observation', async () => {
  const errors = await validate(plainToInstance(AnularPagoDto, { motivo: MotivoAnulacionPago.OTRO }));
  assert.ok(errors.some(error => error.property === 'observacion'));
});

test('successful cancellation preserves financial and plan fields and writes audit fields', async () => {
  const current = payment(1, { fecha: '2026-01-01' });
  const store = new Store({ pagos: [current], movimientos: [originalMovement(1)] });
  const result = await useCase(store).execute(1, dto, 7);
  const saved = store.state.pagos[0];
  assert.deepEqual([saved.monto, saved.fecha, saved.capitalAplicado, saved.interesAplicado, saved.planPagoId], [100, '2026-01-01', 80, 20, 1]);
  assert.equal(saved.estado, EstadoPago.ANULADO);
  assert.equal(store.state.anulaciones.length, 1);
  assert.deepEqual([store.state.anulaciones[0].pagoId, store.state.anulaciones[0].usuarioId, store.state.anulaciones[0].motivo, store.state.anulaciones[0].observacion], [1, 7, MotivoAnulacionPago.OTRO, 'Correction']);
  assert.ok(result.fechaAnulacion instanceof Date);
  assert.equal(result.status, EstadoPago.ANULADO);
  assert.deepEqual(store.events.slice(0, 2), [{ collection: 'prestamos', mode: 'pessimistic_write' }, { collection: 'pagos', mode: 'pessimistic_write' }]);
});

test('active totals exclude annulled payments and cancellation reverses Caja once', async () => {
  const store = new Store({ pagos: [payment(1, { fecha: '2026-01-01' }), payment(2, { fecha: '2026-02-01' })], movimientos: [originalMovement(1), originalMovement(2)] });
  store.state.pagos[1].estado = EstadoPago.ANULADO;
  const result = await useCase(store).execute(1, dto, 7);
  assert.equal(result.totalPagado, 0);
  assert.equal(store.state.movimientos.filter(value => value.concepto === ConceptoMovimientoCaja.REVERSO).length, 1);
  const reversal = store.state.movimientos.find(value => value.concepto === ConceptoMovimientoCaja.REVERSO);
  assert.deepEqual([reversal.tipo, reversal.monto, reversal.movimientoReversadoId], [TipoMovimientoCaja.SALIDA, 100, 1]);
});

test('older payment is rejected while a newer payment is registered, then allowed after newer cancellation', async () => {
  const store = new Store({ pagos: [payment(1, { fecha: '2026-01-01' }), payment(2, { fecha: '2026-02-01' })], movimientos: [originalMovement(1), originalMovement(2)] });
  await assert.rejects(() => useCase(store).execute(1, dto, 7), /pagos posteriores/);
  await useCase(store).execute(2, dto, 7);
  await useCase(store).execute(1, dto, 7);
  assert.equal(store.state.pagos.every(value => value.estado === EstadoPago.ANULADO), true);
});

test('refinancing, historical null, and redistributed plans are rejected', async () => {
  const refinanced = new Store({ pagos: [payment(1)], movimientos: [originalMovement(1)], refinanciamientos: [{ id: 1, prestamoOrigenId: 1 }] });
  await assert.rejects(() => useCase(refinanced).execute(1, dto, 7), /refinanciamiento/);
  const redistributed = new Store({ pagos: [payment(1, { redistribuyoPlan: true })], movimientos: [originalMovement(1)] });
  await assert.rejects(() => useCase(redistributed).execute(1, dto, 7), (error) => error.message === 'Este pago redistribuyó el plan de pago y no puede anularse automáticamente.');
  const historical = new Store({ pagos: [payment(1, { redistribuyoPlan: null })], movimientos: [originalMovement(1)] });
  await assert.rejects(() => useCase(historical).execute(1, dto, 7), (error) => error.message === 'No existe información histórica suficiente para anular este pago automáticamente.');
});

test('redistribuyoPlan false allows cancellation regardless of current plan shape', async () => {
  const store = new Store({ pagos: [payment(1)], movimientos: [originalMovement(1)], planes: defaultPlans().slice(0, 2) });
  await useCase(store).execute(1, dto, 7);
  assert.equal(store.state.pagos[0].estado, EstadoPago.ANULADO);
});

test('CANCELADO returns to ACTIVO when cancellation restores a balance', async () => {
  const store = new Store({ prestamos: [{ id: 1, montoTotal: 100, capital: 80, interes: 20, cantidadPagos: 3, estado: EstadoPrestamo.CANCELADO }], pagos: [payment(1)], movimientos: [originalMovement(1)] });
  const transitions = [];
  await useCase(store, { history: { registrar: async (_manager, ...values) => transitions.push(values) } }).execute(1, dto, 7);
  assert.equal(store.state.prestamos[0].estado, EstadoPrestamo.ACTIVO);
  assert.deepEqual(transitions.map(([loanId, previous, next, _date, userId, observation]) => [loanId, previous, next, userId, observation]), [[1, EstadoPrestamo.CANCELADO, EstadoPrestamo.ACTIVO, 7, 'Correction']]);
});

test('double annulment and double reversal are rejected', async () => {
  const store = new Store({ pagos: [payment(1, { estado: EstadoPago.ANULADO })], movimientos: [originalMovement(1)] });
  await assert.rejects(() => useCase(store).execute(1, dto, 7), /ya fue anulado/);
  const reversalStore = new Store({ pagos: [payment(1)], movimientos: [originalMovement(1), { id: 101, concepto: ConceptoMovimientoCaja.REVERSO, movimientoReversadoId: 1 }] });
  await assert.rejects(() => useCase(reversalStore).execute(1, dto, 7), /already reversed/);
});

test('unique audit row protects against a duplicate cancellation record', async () => {
  const store = new Store({ pagos: [payment(1)], anulaciones: [{ id: 1, pagoId: 1 }], movimientos: [originalMovement(1)] });
  await assert.rejects(() => useCase(store).execute(1, dto, 7), /duplicate audit/);
  assert.equal(store.state.pagos[0].estado, EstadoPago.REGISTRADO);
  assert.equal(store.state.movimientos.length, 1);
});

test('transaction rollback preserves payment and does not leave an orphan reversal', async () => {
  const store = new Store({ pagos: [payment(1)], movimientos: [originalMovement(1)] });
  await assert.rejects(() => useCase(store, { fail: true }).execute(1, dto, 7), /cash failure/);
  assert.equal(store.state.pagos[0].estado, EstadoPago.REGISTRADO);
  assert.equal(store.state.anulaciones.length, 0);
  assert.equal(store.state.movimientos.length, 1);
});

test('three-payment C-to-B-to-A sequence cancels only in reverse chronological order', async () => {
  const store = new Store({ pagos: [payment(1, { fecha: '2026-01-01' }), payment(2, { fecha: '2026-02-01' }), payment(3, { fecha: '2026-03-01' })], movimientos: [originalMovement(1), originalMovement(2), originalMovement(3)] });
  await assert.rejects(() => useCase(store).execute(2, dto, 7), /pagos posteriores/);
  await useCase(store).execute(3, dto, 7);
  await useCase(store).execute(2, dto, 7);
  await useCase(store).execute(1, dto, 7);
  assert.equal(store.state.movimientos.filter(value => value.concepto === ConceptoMovimientoCaja.REVERSO).length, 3);
});

test('600000 loan with 30x20000 plan restores 40000, 60000, and 80000 debt through C-to-B-to-A', async () => {
  const plans = Array.from({ length: 30 }, (_, index) => ({ id: index + 1, prestamoId: 1, numeroPago: index + 1, fechaVencimiento: `2026-${String(index + 1).padStart(2, '0')}-15`, montoProgramado: 20000 }));
  const payments = Array.from({ length: 29 }, (_, index) => payment(index + 1, { fecha: `2026-${String(index + 1).padStart(2, '0')}-01`, monto: 20000, capitalAplicado: 20000, interesAplicado: 0 }));
  const store = new Store({
    prestamos: [{ id: 1, montoTotal: 600000, capital: 600000, interes: 0, cantidadPagos: 30, estado: EstadoPrestamo.ACTIVO }],
    pagos: payments,
    planes: plans,
    movimientos: payments.map(value => originalMovement(value.id, 20000)),
  });
  const originalPlan = clone(store.state.planes);
  const expected = [[29, 40000], [28, 60000], [27, 80000]];

  await assert.rejects(() => useCase(store).execute(28, dto, 7), /pagos posteriores/);
  await assert.rejects(() => useCase(store).execute(27, dto, 7), /pagos posteriores/);
  for (const [paymentId, balance] of expected) {
    const result = await useCase(store).execute(paymentId, dto, 7);
    assert.equal(result.saldoPendiente, balance);
    assert.equal(store.state.pagos.find(value => value.id === paymentId).estado, EstadoPago.ANULADO);
    assert.equal(store.state.movimientos.filter(value => value.concepto === ConceptoMovimientoCaja.REVERSO && value.pagoId === paymentId).length, 1);
  }

  assert.deepEqual(store.state.planes, originalPlan);
  assert.equal(store.state.planes.length, 30);
  assert.deepEqual(store.state.planes.map(value => [value.numeroPago, value.montoProgramado]), plans.map(value => [value.numeroPago, 20000]));
  assert.equal(store.state.anulaciones.length, 3);
  assert.equal(new Set(store.state.anulaciones.map(value => value.pagoId)).size, 3);
  assert.equal(store.state.movimientos.filter(value => value.concepto === ConceptoMovimientoCaja.REVERSO).length, 3);
  assert.equal(store.state.pagos.filter(value => value.estado === EstadoPago.REGISTRADO).reduce((sum, value) => sum + value.monto, 0), 520000);
});

test('transaction rollback removes the Caja reversal when payment persistence fails after Caja', async () => {
  const store = new Store({ pagos: [payment(1)], movimientos: [originalMovement(1)], failPaymentSave: true });
  await assert.rejects(() => useCase(store).execute(1, dto, 7), /payment persistence failure/);
  assert.equal(store.state.pagos[0].estado, EstadoPago.REGISTRADO);
  assert.equal(store.state.anulaciones.length, 0);
  assert.equal(store.state.movimientos.length, 1);
});
