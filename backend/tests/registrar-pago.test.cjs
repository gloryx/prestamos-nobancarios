const assert = require('node:assert/strict');
const test = require('node:test');
const { BadRequestException } = require('@nestjs/common');
const { RegistrarPagoUseCase } = require('../dist/modules/pagos/application/use-cases/registrar-pago.use-case');
const { PlanPagoOrmEntity } = require('../dist/modules/planes-pago/infrastructure/persistence/typeorm/plan-pago.orm-entity');
const { PagoOrmEntity } = require('../dist/modules/pagos/infrastructure/persistence/typeorm/pago.orm-entity');
const { PrestamoOrmEntity } = require('../dist/modules/prestamos/infrastructure/persistence/typeorm/prestamo.orm-entity');

const plan = (id, numeroPago, montoProgramado) => ({ id, prestamoId: 1, numeroPago, montoProgramado, fechaVencimiento: '2026-09-05' });
const payment = (id, planPagoId, monto) => ({ id, prestamoId: 1, planPagoId, monto, capitalAplicado: monto, interesAplicado: 0 });

class FakeDataSource {
  constructor(plans, payments = [], loan = {}) {
    this.plans = plans; this.payments = payments; this.loan = { id: 1, estado: 'ACTIVO', capital: 0, interes: 100, ...loan }; this.loan.montoTotal ??= this.loan.capital + this.loan.interes; this.nextPaymentId = 20; this.failCaja = false;
  }
  transaction(callback) {
    const plans = this.plans.map((item) => ({ ...item })); const payments = this.payments.map((item) => ({ ...item })); const loan = { ...this.loan };
    return Promise.resolve().then(() => callback({ getRepository: (entity) => entity === PlanPagoOrmEntity ? this.planRepository() : entity === PagoOrmEntity ? this.paymentRepository() : this.loanRepository() })).catch((error) => { this.plans.splice(0, this.plans.length, ...plans); this.payments.splice(0, this.payments.length, ...payments); Object.assign(this.loan, loan); throw error; });
  }
  planRepository() {
    return { createQueryBuilder: () => { const builder = { where: () => builder, andWhere: () => builder, orderBy: () => builder, setLock: () => builder, getMany: async () => this.plans.filter((item) => item.prestamoId === 1).sort((a, b) => a.numeroPago - b.numeroPago), getOne: async () => null }; return builder; }, save: async (items) => { for (const item of (Array.isArray(items) ? items : [items])) { const index = this.plans.findIndex((current) => current.id === item.id); if (index >= 0) this.plans[index] = item; } return items; }, remove: async (items) => { for (const item of items) this.plans.splice(this.plans.findIndex((current) => current.id === item.id), 1); return items; } };
  }
  paymentRepository() {
    return { createQueryBuilder: () => { const builder = { where: () => builder, select: () => builder, addSelect: () => builder, leftJoinAndSelect: () => builder, getMany: async () => this.payments.filter((item) => item.prestamoId === 1), getRawOne: async () => ({ total: String(this.payments.reduce((sum, item) => sum + item.monto, 0)), capital: String(this.payments.reduce((sum, item) => sum + item.capitalAplicado, 0)), interes: String(this.payments.reduce((sum, item) => sum + item.interesAplicado, 0)) }), getOne: async () => this.payments.at(-1) ?? null }; return builder; }, save: async (item) => { const saved = { ...item, id: this.nextPaymentId++ }; this.payments.push(saved); return saved; } };
  }
  loanRepository() { return { createQueryBuilder: () => { const builder = { where: () => builder, setLock: () => builder, getOne: async () => this.loan }; return builder; }, save: async (loan) => { this.loan = loan; return loan; } }; }
}

const useCase = (source, users = { buscarPorIdEnTransaccion: async () => ({ activo: true }) }) => new RegistrarPagoUseCase(source, { buscarPorIdEnTransaccion: async () => ({ activo: true }) }, users, { automatico: async () => { if (source.failCaja) throw new Error('Caja falló'); } });
const dto = (planPagoId, monto, fecha = '2026-09-05') => ({ prestamoId: 1, planPagoId, formaPagoId: 1, cobradorId: 1, monto, fecha });

test('rechaza cobrador ausente y nulo antes de crear el pago', async () => {
  const source = new FakeDataSource([plan(1, 1, 100)], [], { capital: 100, interes: 0 });
  let lookups = 0;
  const users = { buscarPorIdEnTransaccion: async () => { lookups += 1; return { activo: true }; } };
  await assert.rejects(useCase(source, users).execute({ ...dto(1, 100), cobradorId: undefined }, 77), /cobrador es obligatorio/);
  await assert.rejects(useCase(source, users).execute({ ...dto(1, 100), cobradorId: null }, 77), /cobrador es obligatorio/);
  assert.equal(lookups, 0);
  assert.equal(source.payments.length, 0);
});

test('valida siempre el cobrador activo y conserva separado al actor autenticado', async () => {
  const source = new FakeDataSource([plan(1, 1, 100)], [], { capital: 100, interes: 0 });
  let receivedId;
  await useCase(source, { buscarPorIdEnTransaccion: async (_manager, id) => { receivedId = id; return { activo: true }; } }).execute({ ...dto(1, 100), cobradorId: 23, observaciones: '   ' }, 77);
  assert.equal(receivedId, 23);
  assert.equal(source.payments.at(-1).observaciones, null);
});

test('rechaza un cobrador inactivo sin crear pago', async () => {
  const source = new FakeDataSource([plan(1, 1, 100)], [], { capital: 100, interes: 0 });
  await assert.rejects(useCase(source, { buscarPorIdEnTransaccion: async () => ({ activo: false }) }).execute({ ...dto(1, 100), cobradorId: 23 }, 77), /cobrador seleccionado está inactivo/);
  assert.equal(source.payments.length, 0);
});

const planAmounts = (source) => source.plans.sort((a, b) => a.id - b.id).map((item) => item.montoProgramado);
const planNumbers = (source) => source.plans.sort((a, b) => a.id - b.id).map((item) => item.numeroPago);

test('permite parcial exacta y conserva el programado', async () => {
  const source = new FakeDataSource([plan(1, 1, 100), plan(2, 2, 100)], [payment(1, 1, 40)], { interes: 200 });
  const result = await useCase(source).execute(dto(1, 60, '2026-09-07'), 9);
  assert.equal(source.plans[0].montoProgramado, 100); assert.equal(source.payments.at(-1).monto, 60);
  assert.equal(source.plans[0].fechaVencimiento, '2026-09-07');
  assert.equal(source.plans[1].fechaVencimiento, '2026-09-05');
  assert.equal(result.fecha.toISOString(), '2026-09-07T00:00:00.000Z');
});

test('keeps the first installment partial and leaves future installments unchanged', async () => {
  const source = new FakeDataSource([plan(1, 1, 10000), plan(2, 2, 12000)], [], { capital: 22000, interes: 0 });
  await useCase(source).execute(dto(1, 8000), 9);
  assert.deepEqual(planAmounts(source), [10000, 12000]);
  assert.equal(source.payments.at(-1).planPagoId, 1);
  assert.equal(source.plans.reduce((sum, item) => sum + item.montoProgramado, 0), 22000);
});

test('keeps the selected amount when a last installment receives a partial payment', async () => {
  const source = new FakeDataSource([plan(1, 1, 10000)], [], { capital: 10000, interes: 0 });
  await useCase(source).execute(dto(1, 8000), 9);
  assert.deepEqual(planAmounts(source), [10000]);
  assert.equal(source.payments.at(-1).monto, 8000);
});

test('redistributes overpayment only after completing the current installment', async () => {
  const one = new FakeDataSource([plan(1, 1, 10000), plan(2, 2, 20000), plan(3, 3, 10000)], [], { capital: 40000, interes: 0 });
  await useCase(one).execute(dto(1, 25000), 9);
  assert.deepEqual(planAmounts(one), [25000, 5000, 10000]);
  const several = new FakeDataSource([plan(1, 1, 10000), plan(2, 2, 10000), plan(3, 3, 15000), plan(4, 4, 20000)], [], { capital: 55000, interes: 0 });
  await useCase(several).execute(dto(1, 35000), 9);
  assert.deepEqual(planAmounts(several), [35000, 20000]);
  assert.equal(several.plans.reduce((sum, item) => sum + item.montoProgramado, 0), 55000);
});

test('assigns the payment date to every affected installment and preserves unaffected dates', async () => {
  const source = new FakeDataSource([
    { ...plan(1, 1, 10000), fechaVencimiento: '2026-09-01' },
    { ...plan(2, 2, 10000), fechaVencimiento: '2026-09-08' },
    { ...plan(3, 3, 15000), fechaVencimiento: '2026-09-15' },
    { ...plan(4, 4, 20000), fechaVencimiento: '2026-09-22' },
  ], [], { capital: 55000, interes: 0 });
  const result = await useCase(source).execute(dto(1, 25000, '2026-10-03'), 9);
  assert.equal(result.fecha.toISOString(), '2026-10-03T00:00:00.000Z');
  assert.deepEqual(source.plans.map((item) => [item.montoProgramado, item.fechaVencimiento]), [[25000, '2026-10-03'], [10000, '2026-10-03'], [20000, '2026-09-22']]);
});

test('redistribuye sobrepago en cascada y elimina solo cuotas futuras sin pagos', async () => {
  const source = new FakeDataSource([plan(1, 1, 100), plan(2, 2, 30), plan(3, 3, 40), plan(4, 4, 50)], [payment(2, 2, 10)], { interes: 220 });
  await useCase(source).execute(dto(1, 160), 9);
  assert.deepEqual(source.plans.map((item) => [item.id, item.montoProgramado]), [[1, 160], [2, 30], [4, 30]]);
});

test('rejects direct attempts to skip the first pending installment with the API message', async () => {
  const source = new FakeDataSource([plan(1, 1, 100), plan(2, 2, 100)], [payment(1, 1, 100)], { interes: 200 });
  await assert.rejects(useCase(source).execute(dto(1, 1), 9), (error) => error instanceof BadRequestException && error.message === 'Debe pagar primero la cuota número 2');
  await useCase(source).execute(dto(2, 100), 9); assert.equal(source.payments.at(-1).planPagoId, 2);
});

test('rejects a later pending installment while the first one is still pending', async () => {
  const source = new FakeDataSource([plan(11, 1, 100), plan(12, 2, 100)], [], { interes: 200 });
  await assert.rejects(useCase(source).execute(dto(12, 100), 9), (error) => error instanceof BadRequestException && error.message === 'Debe pagar primero la cuota número 1');
  assert.equal(source.payments.length, 0);
});

test('keeps a partial installment current and blocks the next installment', async () => {
  const source = new FakeDataSource([plan(1, 1, 100), plan(2, 2, 100)], [payment(1, 1, 40)], { capital: 0, interes: 200 });
  await assert.rejects(useCase(source).execute(dto(2, 1), 9), (error) => error instanceof BadRequestException && error.message === 'Debe pagar primero la cuota número 1');
  assert.equal(source.plans[0].montoProgramado, 100);
  assert.equal(source.payments.length, 1);
});

test('completing the current installment enables the next one', async () => {
  const source = new FakeDataSource([plan(1, 1, 100), plan(2, 2, 100)], [payment(1, 1, 40)], { capital: 200, interes: 0 });
  await useCase(source).execute(dto(1, 60), 9);
  await useCase(source).execute(dto(2, 100), 9);
  assert.deepEqual(source.payments.map((item) => item.planPagoId), [1, 1, 2]);
});

test('skips a future installment that already has a payment and preserves its number', async () => {
  const source = new FakeDataSource([plan(1, 1, 100), plan(2, 2, 100), plan(3, 3, 100)], [payment(1, 2, 20)], { capital: 300, interes: 0 });
  await useCase(source).execute(dto(1, 150), 9);
  assert.deepEqual(source.plans.map((item) => [item.id, item.numeroPago, item.montoProgramado]), [[1, 1, 150], [2, 2, 100], [3, 3, 50]]);
});

test('renumbers only safe future installments after removing zero balances', async () => {
  const source = new FakeDataSource([plan(1, 1, 100), plan(2, 2, 30), plan(3, 3, 40), plan(4, 4, 50)], [], { capital: 220, interes: 0 });
  await useCase(source).execute(dto(1, 160), 9);
  assert.deepEqual(planNumbers(source), [1, 2, 3]);
  assert.deepEqual(planAmounts(source), [160, 10, 50]);
});

test('rejects overpayment beyond the financial balance without changing plan or payments', async () => {
  const source = new FakeDataSource([plan(1, 1, 100), plan(2, 2, 100)], [], { capital: 150, interes: 50 });
  await assert.rejects(useCase(source).execute(dto(1, 201), 9), /saldo pendiente/);
  assert.deepEqual(planAmounts(source), [100, 100]);
  assert.equal(source.payments.length, 0);
});

test('preserves exact cent arithmetic and rejects insufficient redistribution atomically', async () => {
  const source = new FakeDataSource([plan(1, 1, 10.01), plan(2, 2, 10.02)], [], { capital: 20.03, interes: 0 });
  await useCase(source).execute(dto(1, 10.00), 9);
  assert.deepEqual(planAmounts(source), [10.01, 10.02]);
  const failing = new FakeDataSource([plan(1, 1, 10), plan(2, 2, 1), plan(3, 3, 9)], [payment(3, 3, 1)], { capital: 20, interes: 0 });
  await assert.rejects(useCase(failing).execute(dto(1, 15), 9), /suficiente/);
  assert.deepEqual(planAmounts(failing), [10, 1, 9]);
  assert.equal(failing.payments.length, 1);
});

test('uses deterministic lock ordering without Promise.all in the use case', async () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../src/modules/pagos/application/use-cases/registrar-pago.use-case.ts'), 'utf8');
  assert.match(source, /orderBy\('plan\.numero_pago', 'ASC'\)/);
  assert.doesNotMatch(source, /Promise\.all/);
});

test('rolls back payment and plan changes when Caja fails', async () => {
  const source = new FakeDataSource([{ ...plan(1, 1, 100), fechaVencimiento: '2026-09-01' }, { ...plan(2, 2, 100), fechaVencimiento: '2026-09-08' }], [], { interes: 200 }); source.failCaja = true;
  await assert.rejects(useCase(source).execute(dto(1, 150, '2026-10-03'), 9));
  assert.deepEqual(source.plans.map((item) => [item.montoProgramado, item.fechaVencimiento]), [[100, '2026-09-01'], [100, '2026-09-08']]); assert.equal(source.payments.length, 0);
});
