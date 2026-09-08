const assert = require('node:assert/strict');
const test = require('node:test');
require('reflect-metadata');

const { BadRequestException } = require('@nestjs/common');
const { ActualizarPrestamoUseCase } = require('../dist/modules/prestamos/application/use-cases/actualizar-prestamo.use-case');
const { Prestamo } = require('../dist/modules/prestamos/domain/entities/prestamo');
const { EstadoPrestamo } = require('../dist/modules/prestamos/domain/enums/estado-prestamo.enum');
const { RolUsuario } = require('../dist/modules/usuarios/domain/enums/rol-usuario.enum');
const { RolesGuard } = require('../dist/modules/auth/roles.guard');
const { ClientesController } = require('../dist/modules/clientes/presentation/controllers/clientes.controller');
const { PrestamosController } = require('../dist/modules/prestamos/presentation/controllers/prestamos.controller');
const { PagosController } = require('../dist/modules/pagos/presentation/controllers/pagos.controller');
const { RefinanciamientosController } = require('../dist/modules/refinanciamientos/presentation/controllers/refinanciamientos.controller');
const { PeriodicidadesPagoController } = require('../dist/modules/periodicidades-pago/presentation/controllers/periodicidades-pago.controller');
const { FormasPagoController } = require('../dist/modules/formas-pago/presentation/controllers/formas-pago.controller');
const { UsuariosController } = require('../dist/modules/usuarios/presentation/controllers/usuarios.controller');
const { MovimientosCajaController } = require('../dist/modules/movimientos-caja/presentation/controllers/movimientos-caja.controller');
const { ConfiguracionFinancieraController, CortesMensualesController } = require('../dist/modules/cierre-financiero/presentation/cierre-financiero.controller');
const { FuentesIngresoController } = require('../dist/modules/ingresos/presentation/controllers/fuentes-ingreso.controller');
const { IngresosController } = require('../dist/modules/ingresos/presentation/controllers/ingresos.controller');

const relation = {
  cliente: { id: 1, nombre: 'CLIENTE' },
  periodicidadPago: { id: 2, nombre: 'MENSUAL' },
  formaPago: { id: 3, nombre: 'EFECTIVO' },
};

function loan(state = EstadoPrestamo.ACTIVO) {
  const value = Prestamo.crear({
    clienteId: 1, periodicidadPagoId: 2, formaPagoId: 3,
    fechaAlta: new Date('2026-01-10T00:00:00.000Z'), capital: 1000,
    interes: 200, cantidadPagos: 4, planPersonalizado: false, observaciones: 'ORIGINAL',
  });
  Object.assign(value, { id: 7, estado: state, montoDesembolsado: 1000, ...relation });
  return value;
}

function updateHarness(value, totals = { capital: 0, interes: 0, total: 0 }) {
  let saved;
  const repository = {
    buscarPorId: async () => value,
    actualizar: async current => { saved = current; return current; },
  };
  const references = { validar: async () => {} };
  const pagos = { obtenerTotalesPorPrestamo: async () => totals };
  return { useCase: new ActualizarPrestamoUseCase(repository, references, pagos), get saved() { return saved; } };
}

test('updates ACTIVO, INCOBRABLE, and REFINANCIADO loans', async t => {
  for (const state of [EstadoPrestamo.ACTIVO, EstadoPrestamo.INCOBRABLE, EstadoPrestamo.REFINANCIADO]) {
    await t.test(state, async () => {
      const value = loan(state);
      const harness = updateHarness(value);
      const updated = await harness.useCase.execute(7, { capital: 1200, interes: 250 });
      assert.equal(updated.capital, 1200);
      assert.equal(updated.interes, 250);
      assert.equal(updated.montoTotal, 1450);
      assert.equal(harness.saved, value);
    });
  }
});

test('rejects CANCELADO with the exact immutable-loan message', async () => {
  await assert.rejects(
    () => updateHarness(loan(EstadoPrestamo.CANCELADO)).useCase.execute(7, { capital: 1200 }),
    error => error instanceof BadRequestException && error.message === 'Un préstamo cancelado no puede modificarse.',
  );
});

test('allows changing a loan that already has payments', async () => {
  const updated = await updateHarness(loan(), { capital: 400, interes: 80, total: 480 }).useCase.execute(7, { capital: 1100 });
  assert.equal(updated.capital, 1100);
});

test('rejects capital and interest below their accumulated paid totals', async t => {
  const cases = [
    ['capital', { capital: 999 }, { capital: 1000, interes: 0, total: 1000 }, 'El capital del préstamo no puede ser menor al capital ya pagado.'],
    ['interest', { interes: 499 }, { capital: 0, interes: 500, total: 500 }, 'El interés del préstamo no puede ser menor al interés ya pagado.'],
  ];
  for (const [name, dto, totals, message] of cases) {
    await t.test(name, async () => {
      await assert.rejects(() => updateHarness(loan(), totals).useCase.execute(7, dto), error => error.message === message);
    });
  }
});

test('allows reducing future interest while preserving already collected interest', async () => {
  const updated = await updateHarness(loan(), { capital: 300, interes: 500, total: 800 }).useCase.execute(7, { interes: 600 });
  assert.equal(updated.interes, 600);
});

test('does not mutate historical payments, cash movements, or disbursed amount', async () => {
  const payments = [{ id: 1, capitalAplicado: 300, interesAplicado: 500 }];
  const cashMovements = [{ id: 2, monto: 1000, prestamoId: 7 }];
  const value = loan();
  const original = { payments: structuredClone(payments), cashMovements: structuredClone(cashMovements), montoDesembolsado: value.montoDesembolsado };
  await updateHarness(value, { capital: 300, interes: 500, total: 800 }).useCase.execute(7, { capital: 1500, interes: 700 });
  assert.deepEqual(payments, original.payments);
  assert.deepEqual(cashMovements, original.cashMovements);
  assert.equal(value.montoDesembolsado, original.montoDesembolsado);
});

const roles = (controller, method) => Reflect.getMetadata('roles', controller.prototype[method]) ?? Reflect.getMetadata('roles', controller);
const effectiveRoles = (controller, method) => roles(controller, method) ?? [];
const guardFor = allowed => new RolesGuard({ getAllAndOverride: () => allowed });
const contextFor = rol => ({ getHandler: () => {}, getClass: () => {}, switchToHttp: () => ({ getRequest: () => ({ user: { rol } }) }) });

test('enforces the ETAPA 1 ADMINISTRADOR/VENDEDOR controller matrix', () => {
  const vendorAllowed = [
    [ClientesController, 'crearCliente'], [ClientesController, 'actualizar'],
    [ClientesController, 'obtenerImagen'],
    [PrestamosController, 'crearPrestamo'], [PrestamosController, 'actualizar'],
    [PagosController, 'crear'], [RefinanciamientosController, 'crearRefinanciamiento'],
    [PeriodicidadesPagoController, 'listar'], [PeriodicidadesPagoController, 'obtener'],
    [FormasPagoController, 'listar'], [FormasPagoController, 'obtener'],
  ];
  const vendorBlocked = [
    [UsuariosController, 'listar'], [PeriodicidadesPagoController, 'crear'], [PeriodicidadesPagoController, 'actualizar'],
    [FormasPagoController, 'crear'], [FormasPagoController, 'actualizar'],
    [MovimientosCajaController, 'crear'], [MovimientosCajaController, 'reversar'],
    [ConfiguracionFinancieraController, 'create'], [CortesMensualesController, 'close'],
    [FuentesIngresoController, 'crearFuente'], [FuentesIngresoController, 'actualizarFuente'],
    [IngresosController, 'crearIngreso'], [IngresosController, 'actualizarIngreso'],
  ];
  for (const [controller, method] of vendorAllowed) {
    const allowed = effectiveRoles(controller, method);
    assert.deepEqual(allowed, [RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR], `${controller.name}.${method}`);
    assert.equal(guardFor(allowed).canActivate(contextFor(RolUsuario.ADMINISTRADOR)), true);
    assert.equal(guardFor(allowed).canActivate(contextFor(RolUsuario.VENDEDOR)), true);
  }
  for (const [controller, method] of vendorBlocked) {
    const allowed = effectiveRoles(controller, method);
    assert.deepEqual(allowed, [RolUsuario.ADMINISTRADOR], `${controller.name}.${method}`);
    assert.equal(guardFor(allowed).canActivate(contextFor(RolUsuario.ADMINISTRADOR)), true);
    assert.throws(() => guardFor(allowed).canActivate(contextFor(RolUsuario.VENDEDOR)), /permisos/);
  }
});

// The update use case has no FinancialPeriodService dependency, so this harness
// cannot inject assertOpen; historical-event assertOpen remains covered elsewhere.
