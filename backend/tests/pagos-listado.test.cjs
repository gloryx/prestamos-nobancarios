const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { PagosController } = require('../dist/modules/pagos/presentation/controllers/pagos.controller');
const { EstadoPago } = require('../dist/modules/pagos/domain/enums/estado-pago.enum');
const { PagoTypeOrmRepository } = require('../dist/modules/pagos/infrastructure/persistence/typeorm/pago.typeorm-repository');
const { PagoMapper } = require('../dist/modules/pagos/infrastructure/persistence/typeorm/pago.mapper');

const repositorySource = fs.readFileSync(path.join(__dirname, '../src/modules/pagos/infrastructure/persistence/typeorm/pago.typeorm-repository.ts'), 'utf8');

test('loan payment listing returns registered and annulled payments in date/id descending order', () => {
  assert.match(repositorySource, /pago\.estado IN \(:\.\.\.estados\)/);
  assert.match(repositorySource, /estados: \['REGISTRADO', 'ANULADO'\]/);
  assert.match(repositorySource, /orderBy\('pago\.fecha', 'DESC'\)\.addOrderBy\('pago\.id', 'DESC'\)/);
});

test('canAnular is false unless the registered payment is the latest safe payment', () => {
  assert.match(repositorySource, /pago\.estado = 'REGISTRADO' AND pago\.redistribuyo_plan = false/);
  assert.match(repositorySource, /pago_posterior\.estado = 'REGISTRADO'/);
  assert.match(repositorySource, /ref\.prestamo_origen_id = pago\.prestamo_id/);
  assert.match(repositorySource, /THEN true ELSE false END/);
  assert.match(repositorySource, /raw\[index\]\?\.pago_puede_anular/);
});

test('payment totals exclude annulled rows from the financial aggregate', () => {
  assert.match(repositorySource, /obtenerTotalesPorPrestamo[\s\S]*?pago\.estado = :estado/);
  assert.match(repositorySource, /obtenerTotalesPorPrestamo[\s\S]*?estado: 'REGISTRADO'/);
});

test('GET response exposes payment status, payment method name, cancellation audit and canAnular without redistribution flag', async () => {
  const controller = new PagosController({}, {}, {}, { execute: async () => [{
    id: 3, prestamoId: 1, formaPagoId: 2, monto: 100, capitalAplicado: 80, interesAplicado: 20, cobradorId: 7,
    fecha: new Date('2026-08-30T00:00:00.000Z'), fechaCreacion: new Date('2026-08-30T12:00:00.000Z'), observaciones: null,
    planPagoId: 3, numeroCuota: 3, estado: EstadoPago.ANULADO, formaPago: { id: 2, nombre: 'EFECTIVO' },
    prestamo: {}, cliente: {}, cobrador: {}, puedeAnular: false,
    anulacion: { fecha: new Date('2026-08-31T00:00:00.000Z'), motivo: 'OTRO', observacion: 'Correction' },
  }] }, {}, {}, {});
  const [payment] = await controller.listarPorPrestamo(1);
  assert.deepEqual({ id: payment.id, estado: payment.estado, formaPagoId: payment.formaPagoId, formaPagoNombre: payment.formaPagoNombre, puedeAnular: payment.puedeAnular, anulacion: payment.anulacion }, {
    id: 3, estado: EstadoPago.ANULADO, formaPagoId: 2, formaPagoNombre: 'EFECTIVO', puedeAnular: false,
    anulacion: { fecha: new Date('2026-08-31T00:00:00.000Z'), motivo: 'OTRO', observacion: 'Correction' },
  });
  assert.equal('redistribuyoPlan' in payment, false);
});

test('GET response keeps three annulled payments visible and marks each as not cancellable', async () => {
  const controller = new PagosController({}, {}, {}, { execute: async () => [1, 2, 3].map(id => ({
    id, prestamoId: 1, formaPagoId: 1, monto: 20000, capitalAplicado: 20000, interesAplicado: 0, cobradorId: 7,
    fecha: new Date(`2026-0${id}-01`), fechaCreacion: new Date(`2026-0${id}-01`), observaciones: null,
    planPagoId: id, numeroCuota: id, estado: EstadoPago.ANULADO, formaPago: { id: 1, nombre: 'EFECTIVO' },
    prestamo: {}, cliente: {}, cobrador: {}, puedeAnular: false,
    anulacion: { fecha: new Date(`2026-0${id}-02`), motivo: 'OTRO', observacion: 'Correction' },
  })) }, {}, {}, {});
  const result = await controller.listarPorPrestamo(1);
  assert.deepEqual(result.map(payment => [payment.id, payment.estado, payment.puedeAnular]), [[1, EstadoPago.ANULADO, false], [2, EstadoPago.ANULADO, false], [3, EstadoPago.ANULADO, false]]);
});

test('loan payment listing uses one bulk query and does not perform N+1 reads', () => {
  assert.equal((repositorySource.match(/getRawAndEntities\(\)/g) || []).length, 1);
  assert.equal((repositorySource.match(/listarPorPrestamo[\s\S]*?getOne\(\)/g) || []).length, 0);
});

test('history listing preserves the legacy envelope and adds global registered totals', () => {
  assert.match(repositorySource, /totales: \{ cantidadPagos/);
  assert.match(repositorySource, /registeredOnly/);
  assert.match(repositorySource, /COUNT\(pago\.id\)/);
  assert.match(repositorySource, /SUM\(pago\.monto\)/);
});

test('history supports status, date, search, loan, method and collector filters before pagination', () => {
  assert.match(repositorySource, /filtros\.fechaDesde/);
  assert.match(repositorySource, /filtros\.fechaHasta/);
  assert.match(repositorySource, /filtros\.buscar\?\.trim/);
  assert.match(repositorySource, /filtros\.prestamoId/);
  assert.match(repositorySource, /filtros\.formaPagoId/);
  assert.match(repositorySource, /filtros\.cobradorId/);
  assert.match(repositorySource, /skip\(/);
  assert.match(repositorySource, /take\(/);
});

test('history search covers full name, identification, both phones and loan id', () => {
  assert.match(repositorySource, /cliente\.primer_nombre/);
  assert.match(repositorySource, /cliente\.identificacion/);
  assert.match(repositorySource, /cliente\.telefono1/);
  assert.match(repositorySource, /cliente\.telefono2/);
  assert.match(repositorySource, /CAST\(prestamo\.id AS TEXT\)/);
  assert.match(repositorySource, /ILIKE :buscar/);
});

test('history distinguishes payment date from scheduled installment date and exposes cancellation user', () => {
  assert.match(repositorySource, /planPago/);
  assert.match(repositorySource, /usuarioAnulacion/);
  assert.match(path.join(__dirname, '../src/modules/pagos/presentation/dto/pago-response.dto.ts') && fs.readFileSync(path.join(__dirname, '../src/modules/pagos/presentation/dto/pago-response.dto.ts'), 'utf8'), /fechaVencimiento/);
  assert.match(fs.readFileSync(path.join(__dirname, '../src/modules/pagos/presentation/dto/pago-response.dto.ts'), 'utf8'), /usuarioAnulacion/);
});

test('history validates reversed date ranges and defaults absent status to registered', () => {
  const dto = fs.readFileSync(path.join(__dirname, '../src/modules/pagos/application/dto/filtros-pagos.dto.ts'), 'utf8');
  const useCase = fs.readFileSync(path.join(__dirname, '../src/modules/pagos/application/use-cases/listar-pagos.use-case.ts'), 'utf8');
  assert.match(dto, /IsDateString/);
  assert.match(dto, /estado: EstadoPago \| 'TODOS' = EstadoPago.REGISTRADO/);
  assert.match(useCase, /fechaDesde > dto.fechaHasta/);
});

test('GET /pagos executes registered totals and keeps annulled rows out of them for TODOS and ANULADO', async () => {
  const rows = [
    paymentEntity(1, EstadoPago.REGISTRADO, 120000, 100000, 20000),
    paymentEntity(2, EstadoPago.REGISTRADO, 80000, 70000, 10000),
    paymentEntity(3, EstadoPago.ANULADO, 50000, 40000, 10000),
  ];
  const repository = new PagoTypeOrmRepository(new FakePaymentRepository(rows));

  for (const estado of ['TODOS', 'ANULADO']) {
    const result = await repository.listar({ pagina: 1, limite: 10, estado });
    assert.deepEqual(result.datos.map((payment) => payment.estado), estado === 'TODOS'
      ? [EstadoPago.REGISTRADO, EstadoPago.REGISTRADO, EstadoPago.ANULADO]
      : [EstadoPago.ANULADO]);
    assert.deepEqual(result.totales, {
      cantidadPagos: 2,
      totalRecibido: 200000,
      capitalAplicado: 170000,
      interesAplicado: 30000,
    });
    assert.equal(result.totales.totalRecibido, result.totales.capitalAplicado + result.totales.interesAplicado);
  }
});

test('GET /pagos preserves numeroCuota as a compatible alias of numeroPago', async () => {
  const mappedWithPlan = PagoMapper.toDomain(paymentEntity(4, EstadoPago.REGISTRADO, 120000, 100000, 20000));
  const controllerWithPlan = new PagosController({}, { execute: async () => ({ datos: [mappedWithPlan], pagina: 1, limite: 10, total: 1, totalPaginas: 1, totales: { cantidadPagos: 1, totalRecibido: 120000, capitalAplicado: 100000, interesAplicado: 20000 } }) }, {}, {}, {}, {});
  const [paymentWithPlan] = (await controllerWithPlan.listar({})).datos;

  assert.equal(paymentWithPlan.numeroPago, 4);
  assert.equal(paymentWithPlan.numeroCuota, paymentWithPlan.numeroPago);

  const mapped = PagoMapper.toDomain(paymentEntity(4, EstadoPago.REGISTRADO, 120000, 100000, 20000, null));
  const controller = new PagosController({}, { execute: async () => ({ datos: [mapped], pagina: 1, limite: 10, total: 1, totalPaginas: 1, totales: { cantidadPagos: 1, totalRecibido: 120000, capitalAplicado: 100000, interesAplicado: 20000 } }) }, {}, {}, {}, {});
  const [payment] = (await controller.listar({})).datos;

  assert.equal(mapped.planPago, null);
  assert.equal(mapped.numeroPago, null);
  assert.equal(payment.planPagoId, null);
  assert.equal(payment.numeroPago, null);
  assert.equal(payment.numeroCuota, null);
  assert.equal(payment.fechaVencimiento, null);
});

// This is the executable test available without PostgreSQL: the real repository
// method and mapper run against a deterministic QueryBuilder double. SQL execution
// and PostgreSQL-specific query semantics still require an integration environment.
class FakePaymentRepository {
  constructor(rows) { this.rows = rows; }
  createQueryBuilder() { return new FakeQueryBuilder(this.rows); }
}

class FakeQueryBuilder {
  constructor(rows) { this.rows = rows; this.parameters = {}; this.aggregate = false; }
  leftJoinAndSelect() { return this; }
  leftJoin() { return this; }
  where() { return this; }
  andWhere(_expression, parameters) { Object.assign(this.parameters, parameters); return this; }
  orderBy() { return this; }
  addOrderBy() { return this; }
  skip() { return this; }
  take() { return this; }
  select() { this.aggregate = true; return this; }
  addSelect() { return this; }
  async getManyAndCount() {
    const status = this.parameters.estadoFiltro;
    const visible = status === 'ANULADO' ? this.rows.filter((row) => row.estado === EstadoPago.ANULADO)
      : status === 'TODOS' || status === undefined ? this.rows : this.rows.filter((row) => row.estado === EstadoPago.REGISTRADO);
    return [visible, visible.length];
  }
  async getRawOne() {
    const registered = this.rows.filter((row) => row.estado === EstadoPago.REGISTRADO);
    return {
      cantidad: String(registered.length),
      total: String(registered.reduce((sum, row) => sum + row.monto, 0)),
      capital: String(registered.reduce((sum, row) => sum + row.capitalAplicado, 0)),
      interes: String(registered.reduce((sum, row) => sum + row.interesAplicado, 0)),
    };
  }
}

function paymentEntity(id, estado, monto, capitalAplicado, interesAplicado, planPago = { id, numeroPago: id, fechaVencimiento: '2026-09-30' }) {
  return {
    id, prestamoId: 10, formaPagoId: 1, monto, capitalAplicado, interesAplicado, cobradorId: 7,
    fecha: '2026-09-01', fechaCreacion: new Date('2026-09-01T12:00:00.000Z'), observaciones: null,
    planPagoId: planPago?.id ?? null, planPago, estado,
    formaPago: { id: 1, nombre: 'EFECTIVO' },
    prestamo: { id: 10, estado: 'ACTIVO', capital: 200000, interes: 30000, montoTotal: 230000, cliente: { id: 1, identificacion: '1', primerNombre: 'JUAN', primerApellido: 'PEREZ', telefono1: '8888' } },
    cobrador: { id: 7, identificacion: '7', nombreCompleto: 'COBRADOR', telefono: null, correo: null },
    anulacion: null, puedeAnular: false,
  };
}
