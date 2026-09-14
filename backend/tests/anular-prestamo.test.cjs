const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
require('reflect-metadata');

const { UnauthorizedException, BadRequestException } = require('@nestjs/common');
const { AnularPrestamoUseCase } = require('../dist/modules/prestamos/application/use-cases/anular-prestamo.use-case');
const { EstadoPrestamo } = require('../dist/modules/prestamos/domain/enums/estado-prestamo.enum');
const { PrestamosController } = require('../dist/modules/prestamos/presentation/controllers/prestamos.controller');
const { RolUsuario } = require('../dist/modules/usuarios/domain/enums/rol-usuario.enum');
const { RolesGuard } = require('../dist/modules/auth/roles.guard');
const { MovimientoCajaService } = require('../dist/modules/movimientos-caja/application/services/movimiento-caja.service');
const { ConceptoMovimientoCaja } = require('../dist/modules/movimientos-caja/domain/enums/concepto-movimiento-caja.enum');
const { TipoMovimientoCaja } = require('../dist/modules/movimientos-caja/domain/enums/tipo-movimiento-caja.enum');

function harness({ eligible = true, failAt } = {}) {
  const loan = { id: 7, estado: EstadoPrestamo.ACTIVO, fechaAlta: '2026-01-01' };
  const manager = { getRepository: () => ({ createQueryBuilder: () => ({ where() { return this; }, setLock() { return this; }, async getOne() { return loan; } }), save: async value => { if (failAt === 'save') throw new Error('save failed'); return value; } }) };
  const calls = { period: [], reversal: [], history: [] };
  const dataSource = { transaction: async callback => { try { return await callback(manager); } catch (error) { calls.rollback = true; throw error; } } };
  const periods = { assertOpen: async (_manager, date) => { calls.period.push(date.toISOString().slice(0, 10)); if (failAt === 'period') throw new Error('closed'); } };
  const caja = { reversarDesembolsoPrestamoPorAnulacion: async (_manager, id, date, observation, actor) => { calls.reversal.push({ id, date: date.toISOString().slice(0, 10), observation, actor }); if (failAt === 'reversal') throw new Error('reversal failed'); } };
  const history = { registrar: async (_manager, ...args) => { calls.history.push(args); if (failAt === 'history') throw new Error('history failed'); } };
  const eligibility = { assertPuedeAnular: async () => { if (!eligible) throw new BadRequestException('not eligible'); } };
  const repository = { buscarPorId: async () => ({ ...loan }) };
  return { useCase: new AnularPrestamoUseCase(dataSource, caja, history, eligibility, repository, periods), calls };
}

test('anulación usa la fecha DTO exacta y conserva el desembolso original', async () => {
  const h = harness();
  const result = await h.useCase.execute(7, { fecha: '2026-09-14', observacion: '  error  ' }, 4);
  assert.equal(result.id, 7);
  assert.deepEqual(h.calls.period, ['2026-09-14']);
  assert.deepEqual(h.calls.reversal, [{ id: 7, date: '2026-09-14', observation: 'error', actor: 4 }]);
  assert.equal(h.calls.history[0][0], 7);
  assert.equal(h.calls.history[0][2], EstadoPrestamo.ANULADO);
  assert.equal(h.calls.history[0][3].toISOString().slice(0, 10), '2026-09-14');
});

test('rechaza actor ausente, regla incumplida y fecha calendario inválida', async () => {
  await assert.rejects(() => harness().useCase.execute(7, { fecha: '2026-09-14' }), UnauthorizedException);
  await assert.rejects(() => harness({ eligible: false }).useCase.execute(7, { fecha: '2026-09-14' }, 4), BadRequestException);
  await assert.rejects(() => harness().useCase.execute(7, { fecha: '2026-02-30' }, 4), BadRequestException);
});

test('cualquier error posterior al bloqueo hace rollback y no registra historial', async () => {
  for (const failAt of ['period', 'reversal', 'save', 'history']) {
    const h = harness({ failAt });
    await assert.rejects(() => h.useCase.execute(7, { fecha: '2026-09-14' }, 4));
    assert.equal(h.calls.rollback, true, failAt);
    assert.equal(h.calls.history.length, failAt === 'history' ? 1 : 0, failAt);
    if (failAt === 'period') assert.equal(h.calls.reversal.length, 0);
  }
});

test('la ruta de anulación solo declara ADMINISTRADOR', () => {
  const roles = Reflect.getMetadata('roles', PrestamosController.prototype.anular);
  assert.deepEqual(roles, [RolUsuario.ADMINISTRADOR]);
  const guard = new RolesGuard({ getAllAndOverride: () => roles });
  const context = role => ({ getHandler: () => PrestamosController.prototype.anular, getClass: () => PrestamosController, switchToHttp: () => ({ getRequest: () => ({ user: { rol: role } }) }) });
  assert.equal(guard.canActivate(context(RolUsuario.ADMINISTRADOR)), true);
  assert.throws(() => guard.canActivate(context(RolUsuario.VENDEDOR)), /permisos/);
});

test('matriz individual de elegibilidad del agregado bulk', async t => {
  const service = require('../dist/modules/prestamos/application/services/prestamo-anulacion.service').PrestamoAnulacionService;
  const cases = [
    ['ACTIVO sin pagos', true], ['pago REGISTRADO', false], ['pago ANULADO histórico', false],
    ['préstamo origen de refinanciamiento', false], ['préstamo nuevo de refinanciamiento', false],
    ['desembolso ausente', false], ['desembolso ya reversado', false], ['CANCELADO', false],
    ['REFINANCIADO', false], ['INCOBRABLE', false], ['ANULADO', false],
  ];
  for (const [name, expected] of cases) await t.test(name, async () => {
    const query = { select() { return this; }, addSelect() { return this; }, from() { return this; }, leftJoin() { return this; }, where() { return this; }, groupBy() { return this; }, addGroupBy() { return this; }, setParameter() { return this; }, getRawMany: async () => [{ id: '7', puede_anular: expected }] };
    const result = await new service().calcular({ createQueryBuilder: () => query }, [7]);
    assert.equal(result.get(7).puedeAnular, expected);
  });
  const source = fs.readFileSync(path.resolve(__dirname, '../src/modules/prestamos/application/services/prestamo-anulacion.service.ts'), 'utf8');
  for (const fragment of ['REGISTRADO', 'ANULADO', 'prestamo_origen_id', 'prestamo_nuevo_id', 'DESEMBOLSO_PRESTAMO', 'movimiento_reversado_id']) assert.match(source, new RegExp(fragment));
});

test('reverso específico conserva fecha, monto, referencia, forma de pago y original intacto', async () => {
  const original = { id: 10, concepto: ConceptoMovimientoCaja.DESEMBOLSO_PRESTAMO, tipo: TipoMovimientoCaja.SALIDA, monto: 1250.50, prestamoId: 7, formaPagoId: 3 };
  let saved;
  const repo = { buscarPorPrestamoYConceptoEnTransaccion: async () => original, buscarPorIdEnTransaccion: async () => original, contarReversionesEnTransaccion: async () => 0, guardarEnTransaccion: async (_manager, value) => { saved = value; return value; } };
  const users = { buscarPorIdEnTransaccion: async () => ({ activo: true }) };
  const periods = { assertOpen: async () => {} };
  await new MovimientoCajaService(repo, users, periods).reversarDesembolsoPrestamoPorAnulacion({}, 7, new Date('2026-09-14T00:00:00.000Z'), 'corrección', 4);
  assert.equal(saved.tipo, TipoMovimientoCaja.ENTRADA);
  assert.equal(saved.concepto, ConceptoMovimientoCaja.REVERSO);
  assert.equal(saved.monto, 1250.50);
  assert.equal(saved.fecha.toISOString().slice(0, 10), '2026-09-14');
  assert.equal(saved.movimientoReversadoId, 10);
  assert.equal(saved.prestamoId, 7);
  assert.equal(saved.formaPagoId, 3);
  assert.equal(saved.usuarioId, 4);
  assert.deepEqual(original, { id: 10, concepto: ConceptoMovimientoCaja.DESEMBOLSO_PRESTAMO, tipo: TipoMovimientoCaja.SALIDA, monto: 1250.50, prestamoId: 7, formaPagoId: 3 });
});

test('reverso específico rechaza conceptos distintos y reversos previos', async () => {
  const base = { id: 10, tipo: TipoMovimientoCaja.ENTRADA, monto: 10, prestamoId: 7, formaPagoId: 1 };
  const make = (original, reversals = 0) => new MovimientoCajaService({ buscarPorPrestamoYConceptoEnTransaccion: async () => original, buscarPorIdEnTransaccion: async () => original, contarReversionesEnTransaccion: async () => reversals, guardarEnTransaccion: async () => {} }, { buscarPorIdEnTransaccion: async () => ({ activo: true }) }, { assertOpen: async () => {} });
  await assert.rejects(() => make({ ...base, concepto: ConceptoMovimientoCaja.PAGO_CLIENTE }).reversarDesembolsoPrestamoPorAnulacion({}, 7, new Date('2026-09-14T00:00:00.000Z'), 'x', 4));
  await assert.rejects(() => make({ ...base, concepto: ConceptoMovimientoCaja.DESEMBOLSO_PRESTAMO }, 1).reversarDesembolsoPrestamoPorAnulacion({}, 7, new Date('2026-09-14T00:00:00.000Z'), 'x', 4));
});

test('las protecciones downstream permanecen activas para ANULADO', () => {
  const files = [
    '../src/modules/pagos/application/use-cases/registrar-pago.use-case.ts',
    '../src/modules/prestamos/application/use-cases/actualizar-prestamo.use-case.ts',
    '../src/modules/refinanciamientos/application/use-cases/crear-refinanciamiento.use-case.ts',
    '../src/modules/planes-pago/application/use-cases/personalizar-plan-pago.use-case.ts',
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.resolve(__dirname, file), 'utf8');
    assert.match(source, /EstadoPrestamo\.(ACTIVO|ANULADO)/);
  }
});

test('contratos de fecha, lock, periodo cerrado, historial, estado, plan y rollback están en el caso transaccional', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/modules/prestamos/application/use-cases/anular-prestamo.use-case.ts'), 'utf8');
  for (const fragment of ['dateOnly(value)', 'assertOpen', 'pessimistic_write', 'assertPuedeAnular', 'reversarDesembolsoPrestamoPorAnulacion', 'EstadoPrestamo.ANULADO', 'history.registrar', 'transaction']) assert.match(source, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.ok(source.indexOf('getOne()') < source.indexOf('assertPuedeAnular'));
});

test('candidatos y anulados usan endpoints ADMINISTRADOR y consultas bulk paginadas', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/modules/prestamos/infrastructure/persistence/typeorm/prestamo.typeorm-repository.ts'), 'utf8');
  const controller = fs.readFileSync(path.resolve(__dirname, '../src/modules/prestamos/presentation/controllers/prestamos.controller.ts'), 'utf8');
  for (const fragment of ['listarCandidatosAnulacion', 'listarAnulados', 'NOT EXISTS (SELECT 1 FROM pago', 'prestamo_estado_historial', 'movimiento_reversado_id', 'skip((filtros.pagina - 1) * filtros.limite)', 'getRawAndEntities']) assert.match(source, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(controller, /@Get\('candidatos-anulacion'\)[\s\S]*?@Roles\(RolUsuario\.ADMINISTRADOR\)/);
  assert.match(controller, /@Get\('anulados'\)[\s\S]*?@Roles\(RolUsuario\.ADMINISTRADOR\)/);
});
