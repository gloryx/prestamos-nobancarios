const assert = require('node:assert/strict');
const test = require('node:test');

const { ConflictException } = require('@nestjs/common');
const { RefinanciamientoQueries } = require('../dist/modules/refinanciamientos/application/use-cases/refinanciamiento-queries.use-cases');
const { ObtenerCadenasClienteUseCase } = require('../dist/modules/refinanciamientos/application/use-cases/obtener-cadenas-cliente.use-case');
const { CrearRefinanciamientoUseCase } = require('../dist/modules/refinanciamientos/application/use-cases/crear-refinanciamiento.use-case');
const { RefinanciamientosController } = require('../dist/modules/refinanciamientos/presentation/controllers/refinanciamientos.controller');
const { RefinanciamientoTypeOrmRepository } = require('../dist/modules/refinanciamientos/infrastructure/persistence/typeorm/refinanciamiento.typeorm-repository');
const { EstadoPrestamo } = require('../dist/modules/prestamos/domain/enums/estado-prestamo.enum');
const { calcularDiasGanados } = require('../dist/modules/refinanciamientos/application/services/calcular-dias-ganados');

const relation = (id, prestamoOrigenId, prestamoNuevoId) => ({
  id,
  prestamoOrigenId,
  prestamoNuevoId,
});

test('diasGanados uses calendar dates, returns null without a snapshot, and is never negative', () => {
  const day = value => new Date(`${value}T00:00:00.000Z`);
  assert.equal(calcularDiasGanados(day('2026-09-10'), day('2026-09-01')), 9);
  assert.equal(calcularDiasGanados(day('2026-09-01'), day('2026-09-01')), 0);
  assert.equal(calcularDiasGanados(day('2026-08-31'), day('2026-09-01')), 0);
  assert.equal(calcularDiasGanados(null, day('2026-09-01')), null);
});

class FakeRefinanciamientoRepository {
  constructor(relations) {
    this.relations = relations;
  }

  async buscarPorPrestamoOrigenId(id) {
    return this.relations.find(value => value.prestamoOrigenId === id) ?? null;
  }

  async buscarPorPrestamoNuevoId(id) {
    return this.relations.find(value => value.prestamoNuevoId === id) ?? null;
  }

  async buscarPorId(id) {
    return this.relations.find(value => value.id === id) ?? null;
  }

  async existePorPrestamoOrigenId(id) {
    return Boolean(await this.buscarPorPrestamoOrigenId(id));
  }

  async existePorPrestamoNuevoId(id) {
    return Boolean(await this.buscarPorPrestamoNuevoId(id));
  }

  async listar() {
    return { datos: this.relations, pagina: 1, limite: 10, total: this.relations.length, totalPaginas: 1 };
  }

  async guardar(value) {
    return value;
  }
}

const listedRefinancing = (id, cliente) => ({
  id,
  prestamoOrigenId: id * 10,
  prestamoNuevoId: id * 10 + 1,
  fecha: new Date('2026-09-01T00:00:00.000Z'),
  capitalPendiente: 100,
  interesPendiente: 0,
  montoRefinanciado: 100,
  interesNuevo: 20,
  observaciones: null,
  fechaCreacion: new Date('2026-09-01T00:00:00.000Z'),
  fechaLimiteContractualOrigen: null,
  cliente,
  prestamoNuevo: { montoDesembolsado: 50 },
});

test('GET /refinanciamientos preserves the paginated envelope and adds the origin client summary', async () => {
  let receivedFilters;
  const queries = { listar: async filters => { receivedFilters = filters; return { datos: [listedRefinancing(1, { id: 7, identificacion: '1-111-111', nombreCompleto: 'ANA MARIA LOPEZ' })], pagina: 2, limite: 1, total: 3, totalPaginas: 3 }; } };
  const controller = new RefinanciamientosController(null, queries, null);

  const result = await controller.listar({ pagina: 2, limite: 1, buscar: 'ana', clienteId: 7, fechaDesde: '2026-01-01', fechaHasta: '2026-12-31' });

  assert.deepEqual(receivedFilters, { pagina: 2, limite: 1, buscar: 'ana', clienteId: 7, fechaDesde: '2026-01-01', fechaHasta: '2026-12-31' });
  assert.deepEqual(Object.keys(result), ['datos', 'pagina', 'limite', 'total', 'totalPaginas']);
  assert.equal(result.datos.length, 1);
  assert.deepEqual(result.datos[0].cliente, { id: 7, identificacion: '1-111-111', nombreCompleto: 'ANA MARIA LOPEZ' });
  assert.equal(result.pagina, 2);
  assert.equal(result.limite, 1);
  assert.equal(result.total, 3);
  assert.equal(result.totalPaginas, 3);
  assert.equal(result.datos[0].montoRefinanciado, 100);
});

test('GET /refinanciamientos supports empty and multiple listed rows without changing totals', async () => {
  const rows = [listedRefinancing(1, { id: 7, identificacion: '1-111-111', nombreCompleto: 'ANA LOPEZ' }), listedRefinancing(2, { id: 8, identificacion: '2-222-222', nombreCompleto: 'JUAN PEREZ' })];
  const controller = new RefinanciamientosController(null, { listar: async () => ({ datos: rows, pagina: 1, limite: 10, total: 2, totalPaginas: 1 }) }, null);
  const result = await controller.listar({ pagina: 1, limite: 10 });
  assert.equal(result.datos.length, 2);
  assert.deepEqual(result.datos.map(value => value.cliente.id), [7, 8]);
  assert.equal(result.total, 2);

  const emptyController = new RefinanciamientosController(null, { listar: async () => ({ datos: [], pagina: 1, limite: 10, total: 0, totalPaginas: 0 }) }, null);
  const empty = await emptyController.listar({ pagina: 1, limite: 10 });
  assert.deepEqual(empty.datos, []);
  assert.equal(empty.total, 0);
  assert.equal(empty.totalPaginas, 0);
});

const reportRow = (id, clientId, capital, disbursement, newCapital, interest, days) => ({
  id, prestamoOrigenId: id * 10, prestamoNuevoId: id * 10 + 1, fecha: new Date(`2026-09-${String(id).padStart(2, '0')}T00:00:00.000Z`),
  capitalPendiente: capital, interesNuevo: interest, fechaLimiteContractualOrigen: days === null ? null : new Date(`2026-09-${String(id + days).padStart(2, '0')}T00:00:00.000Z`),
  cliente: { id: clientId, identificacion: `${clientId}-ID`, nombreCompleto: `CLIENT ${clientId}` },
  prestamoNuevo: { capital: newCapital, montoDesembolsado: disbursement },
});

test('GET /refinanciamientos/reporte returns empty summary and normalized absent filters', async () => {
  let receivedFilters;
  const queries = new RefinanciamientoQueries({ listarReporte: async filters => { receivedFilters = filters; return []; } });
  const controller = new RefinanciamientosController(null, queries, null);
  const result = await controller.reporte({});

  assert.deepEqual(receivedFilters, { buscar: undefined, clienteId: undefined, fechaDesde: undefined, fechaHasta: undefined });
  assert.deepEqual(result.filtros, { buscar: null, clienteId: null, fechaDesde: null, fechaHasta: null });
  assert.deepEqual(result.resumen, {
    cantidadRefinanciamientos: 0, cantidadClientes: 0, totalCapitalTrasladado: 0, totalDineroNuevoDesembolsado: 0,
    totalCapitalNuevo: 0, totalInteresNuevoPactado: 0, refinanciamientosConDineroNuevo: 0, refinanciamientosSinDineroNuevo: 0,
    refinanciamientosAnticipados: 0, refinanciamientosSinAnticipacion: 0, promedioDiasGanados: null, diasGanadosCompletos: true,
  });
  assert.deepEqual(result.datos, []);
});

test('GET /refinanciamientos/reporte applies all filters and returns exact detail shape and summary metrics', async () => {
  let receivedFilters;
  const rows = [reportRow(3, 7, 100.005, 50.005, 150.005, 20.005, 2), reportRow(2, 7, 200, 0, 250, 30, 0), reportRow(1, 8, 300, 10, 310, 40, null)];
  const queries = new RefinanciamientoQueries({ listarReporte: async filters => { receivedFilters = filters; return rows; } });
  const controller = new RefinanciamientosController(null, queries, null);
  const result = await controller.reporte({ buscar: '  10  ', clienteId: 7, fechaDesde: '2026-01-01', fechaHasta: '2026-12-31' });

  assert.deepEqual(receivedFilters, { buscar: '10', clienteId: 7, fechaDesde: '2026-01-01', fechaHasta: '2026-12-31' });
  assert.deepEqual(result.filtros, { buscar: '10', clienteId: 7, fechaDesde: '2026-01-01', fechaHasta: '2026-12-31' });
  assert.deepEqual(result.resumen, {
    cantidadRefinanciamientos: 3, cantidadClientes: 2, totalCapitalTrasladado: 600.01, totalDineroNuevoDesembolsado: 60.01,
    totalCapitalNuevo: 710.01, totalInteresNuevoPactado: 90.01, refinanciamientosConDineroNuevo: 2, refinanciamientosSinDineroNuevo: 1,
    refinanciamientosAnticipados: 1, refinanciamientosSinAnticipacion: 1, promedioDiasGanados: 1, diasGanadosCompletos: false,
  });
  assert.deepEqual(result.datos[0], {
    id: 3, fecha: '2026-09-03', cliente: { id: 7, identificacion: '7-ID', nombreCompleto: 'CLIENT 7' }, prestamoOrigenId: 30,
    capitalTrasladado: 100.01, dineroNuevoDesembolsado: 50.01, capitalNuevo: 150.01, interesNuevo: 20.01, diasGanados: 2, prestamoNuevoId: 31,
  });
  assert.deepEqual(Object.keys(result.datos[0]), ['id', 'fecha', 'cliente', 'prestamoOrigenId', 'capitalTrasladado', 'dineroNuevoDesembolsado', 'capitalNuevo', 'interesNuevo', 'diasGanados', 'prestamoNuevoId']);
});

test('refinancing report repository performs one joined query and applies stable date/id ordering without N+1', async () => {
  let queryBuilderCalls = 0;
  let getManyCalls = 0;
  const entity = { id: 2, prestamoOrigenId: 20, prestamoNuevoId: 21, fecha: '2026-09-02', capitalPendiente: 100, interesNuevo: 20, fechaLimiteContractualOrigen: null,
    prestamoOrigen: { id: 20, clienteId: 7, cliente: { id: 7, identificacion: '7-ID', primerNombre: 'ANA', primerApellido: 'LOPEZ' } },
    prestamoNuevo: { id: 21, clienteId: 7, capital: 100, montoDesembolsado: 0 } };
  const builder = {
    leftJoinAndSelect() { return this; }, andWhere() { return this; }, orderBy(field, direction) { this.orders = [[field, direction]]; return this; },
    addOrderBy(field, direction) { this.orders.push([field, direction]); return this; },
    async getMany() { getManyCalls += 1; return [entity]; },
  };
  const repository = new RefinanciamientoTypeOrmRepository({ createQueryBuilder() { queryBuilderCalls += 1; return builder; } });
  const result = await repository.listarReporte({ buscar: 'ANA', clienteId: 7, fechaDesde: '2026-01-01', fechaHasta: '2026-12-31' });

  assert.equal(queryBuilderCalls, 1);
  assert.equal(getManyCalls, 1);
  assert.deepEqual(builder.orders, [['ref.fecha', 'DESC'], ['ref.id', 'DESC']]);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].cliente, { id: 7, identificacion: '7-ID', nombreCompleto: 'ANA LOPEZ' });
});

test('refinanciamiento listing uses the joined origin client and does not perform N+1 queries', async () => {
  let queryBuilderCalls = 0;
  let getManyAndCountCalls = 0;
  const entity = {
    id: 1,
    prestamoOrigenId: 10,
    prestamoNuevoId: 11,
    fecha: '2026-09-01',
    capitalPendiente: 100,
    interesPendiente: 0,
    montoRefinanciado: 100,
    interesNuevo: 20,
    observaciones: null,
    fechaCreacion: new Date('2026-09-01T00:00:00.000Z'),
    prestamoOrigen: {
      id: 10,
      clienteId: 7,
      cliente: { id: 7, identificacion: '1-111-111', primerNombre: 'ANA', segundoNombre: null, primerApellido: 'MARIA', segundoApellido: 'LOPEZ' },
    },
    prestamoNuevo: { id: 11, clienteId: 7 },
  };
  const builder = {
    leftJoinAndSelect() { return this; },
    andWhere() { return this; },
    orderBy() { return this; },
    addOrderBy() { return this; },
    skip(value) { this.skipValue = value; return this; },
    take(value) { this.takeValue = value; return this; },
    async getManyAndCount() { getManyAndCountCalls += 1; return [[entity], 4]; },
  };
  const repository = new RefinanciamientoTypeOrmRepository({
    createQueryBuilder() { queryBuilderCalls += 1; return builder; },
  });

  const result = await repository.listar({ pagina: 2, limite: 2, buscar: 'ANA', clienteId: 7, fechaDesde: '2026-01-01', fechaHasta: '2026-12-31' });

  assert.equal(queryBuilderCalls, 1);
  assert.equal(getManyAndCountCalls, 1);
  assert.equal(builder.skipValue, 2);
  assert.equal(builder.takeValue, 2);
  assert.deepEqual(result.datos[0].cliente, { id: 7, identificacion: '1-111-111', nombreCompleto: 'ANA MARIA LOPEZ' });
  assert.equal(result.total, 4);
  assert.equal(result.totalPaginas, 2);
});

const chainCases = [
  ['A: 100 -> 101', [relation(1, 100, 101)], 100, [1]],
  ['B: 100 -> 101 -> 102', [relation(1, 100, 101), relation(2, 101, 102)], 100, [1, 2]],
  ['C: 100 -> 101 -> 102 -> 103', [relation(1, 100, 101), relation(2, 101, 102), relation(3, 102, 103)], 100, [1, 2, 3]],
];

for (const [name, relations, startingLoan, expectedIds] of chainCases) {
  test(`returns the complete available chain for ${name}`, async () => {
    const queries = new RefinanciamientoQueries(new FakeRefinanciamientoRepository(relations));
    const result = await queries.cadena(startingLoan);
    assert.deepEqual(result.map(value => value.id), expectedIds);
  });
}

test('returns the complete chain when queried from every loan in C', async () => {
  const relations = [relation(1, 100, 101), relation(2, 101, 102), relation(3, 102, 103)];
  const queries = new RefinanciamientoQueries(new FakeRefinanciamientoRepository(relations));

  for (const startingLoan of [100, 101, 102, 103]) {
    const result = await queries.cadena(startingLoan);
    assert.deepEqual(result.map(value => value.id), [1, 2, 3]);
  }
});

test('stops safely when the relations contain a cycle', async () => {
  const relations = [relation(1, 100, 101), relation(2, 101, 100)];
  const queries = new RefinanciamientoQueries(new FakeRefinanciamientoRepository(relations));

  const result = await queries.cadena(100);
  assert.deepEqual(result.map(value => value.id), [1, 2]);
  assert.equal(new Set(result.map(value => value.id)).size, result.length);
});

test('create blocks only an already-refinanced origin and preserves HTTP 409', async () => {
  let countWhere;
  const origin = { id: 100, estado: EstadoPrestamo.ACTIVO };
  const planQueryBuilder = {
    select() { return this; },
    where() { return this; },
    async getRawOne() { return { fechaLimiteContractualOrigen: '2026-12-31' }; },
  };
  const queryBuilder = {
    leftJoinAndSelect() { return this; },
    where() { return this; },
    setLock() { return this; },
    async getOne() { return origin; },
  };
  const dataSource = {
    async transaction(callback) {
      return callback({
        getRepository(entity) {
           if (entity.name === 'PrestamoOrmEntity') return { createQueryBuilder: () => queryBuilder };
           if (entity.name === 'PlanPagoOrmEntity') return { createQueryBuilder: () => planQueryBuilder };
           if (entity.name === 'RefinanciamientoOrmEntity') {
            return { count: async ({ where }) => { countWhere = where; return 1; } };
          }
          throw new Error(`Unexpected repository: ${entity.name}`);
        },
      });
    },
  };

  await assert.rejects(
    () => new CrearRefinanciamientoUseCase(dataSource, { validarActor: async () => {} }).execute({ prestamoOrigenId: 100 }, 1),
    error => {
      assert.ok(error instanceof ConflictException);
      assert.equal(error.getStatus(), 409);
      assert.equal(error.message, 'El préstamo ya fue refinanciado.');
      return true;
    },
  );
  assert.deepEqual(countWhere, { prestamoOrigenId: 100 });
});

test('create locks the origin loan before checking refinancing integrity', async () => {
  let lockMode;
  let lockTables;
  let transactionalManager;
  const manager = {
    getRepository(entity) {
      if (entity.name === 'PrestamoOrmEntity') return { createQueryBuilder: () => queryBuilder };
      if (entity.name === 'RefinanciamientoOrmEntity') return { count: async () => 0 };
      throw new Error(`Unexpected repository: ${entity.name}`);
    },
  };
  const queryBuilder = {
    leftJoinAndSelect() { return this; },
    where() { return this; },
    setLock(mode, _version, tables) { lockMode = mode; lockTables = tables; return this; },
    async getOne() { return { id: 100, estado: EstadoPrestamo.ACTIVO }; },
  };
  const dataSource = {
    async transaction(callback) {
      transactionalManager = manager;
      return callback(manager);
    },
  };

  await assert.rejects(
    () => new CrearRefinanciamientoUseCase(dataSource, { validarActor: async () => {} }).execute({ prestamoOrigenId: 100 }, 1),
    /Unexpected repository/,
  );
  assert.equal(lockMode, 'pessimistic_write');
  assert.deepEqual(lockTables, ['p']);
  assert.equal(transactionalManager, manager);
});

const chainClient = (id = 7) => ({
  id,
  identificacion: '1-111-111',
  primerNombre: 'ANA',
  segundoNombre: 'MARIA',
  primerApellido: 'LOPEZ',
  segundoApellido: null,
  genero: null,
  fechaNacimiento: null,
  direccion: 'San Jose',
  correo: 'ana@example.test',
  telefono1: '8888-8888',
  telefono2: null,
  nacionalidad: null,
  observaciones: null,
  fechaIngreso: new Date('2026-01-01T00:00:00.000Z'),
  urlIdentificacion: null,
  activo: true,
});

const chainLoan = (id, fechaAlta, capital, clienteId = 7) => ({
  id, clienteId, estado: 'ACTIVO', fechaAlta: new Date(`${fechaAlta}T00:00:00.000Z`),
  capital, interes: 20, montoTotal: capital + 20, montoDesembolsado: capital,
});

const chainRelation = (id, origen, nuevo, fecha, capitalPendiente, dineroNuevo, interesNuevo, clienteId = 7) => ({
  id, prestamoOrigenId: origen, prestamoNuevoId: nuevo, fecha: new Date(`${fecha}T00:00:00.000Z`),
  capitalPendiente, interesPendiente: 0, montoRefinanciado: capitalPendiente, interesNuevo,
  observaciones: null, fechaCreacion: new Date(`${fecha}T00:00:00.000Z`),
  fechaLimiteContractualOrigen: null,
  prestamoNuevo: { montoDesembolsado: dineroNuevo, clienteId },
});

const chainData = (prestamos, refinanciamientos, cliente = chainClient(), pagosPorPrestamo = {}) => ({ cliente, prestamos, refinanciamientos, pagosPorPrestamo });

test('bulk endpoint groups independent chains and orders them deterministically', async () => {
  const data = chainData(
    [chainLoan(30, '2026-01-10', 300), chainLoan(10, '2026-01-01', 100), chainLoan(11, '2026-02-01', 110), chainLoan(31, '2026-01-11', 310)],
    [chainRelation(2, 10, 11, '2026-02-05', 80, 25, 12), chainRelation(1, 30, 31, '2026-01-12', 250, 0, 8)],
  );
  const result = await new ObtenerCadenasClienteUseCase({ buscarDatosCadenasPorClienteId: async () => data }).execute(7);

  assert.deepEqual(result.cadenas.map(value => [value.prestamoRaizId, value.prestamoTerminalId]), [[10, 11], [30, 31]]);
  assert.deepEqual(result.cadenas[0].transiciones.map(value => value.refinanciamientoId), [2]);
  assert.deepEqual(result.cadenas[1].transiciones.map(value => value.refinanciamientoId), [1]);
});

test('bulk endpoint returns the complete monetary, date, summary, and response contract', async () => {
  const data = chainData(
    [chainLoan(100, '2026-03-01', 1000), chainLoan(101, '2026-04-01', 1200), chainLoan(102, '2026-05-01', 1400)],
    [chainRelation(7, 100, 101, '2026-04-15', 900.125, 100.456, 20.239), chainRelation(8, 101, 102, '2026-05-15', 800.335, 200.555, 30.555)],
    chainClient(),
    { 100: 100.005, 101: 200.005, 102: 300.005 },
  );
  const useCase = new ObtenerCadenasClienteUseCase({ buscarDatosCadenasPorClienteId: async () => data });
  const controller = new RefinanciamientosController(null, null, null, useCase);
  const result = await controller.cadenasPorCliente(7);

  assert.deepEqual(Object.keys(result), ['cliente', 'convencionOrdenFechaInicio', 'resumen', 'cadenas']);
  assert.equal(result.cliente.id, 7);
  assert.equal(result.cliente.fechaNacimiento, null);
  assert.equal(result.cadenas[0].fechaInicio, '2026-03-01');
  assert.equal(result.cadenas[0].resumen.fechaUltimoRefinanciamiento, '2026-05-15');
  assert.deepEqual(result.cadenas[0].transiciones[0], {
    refinanciamientoId: 7, fecha: '2026-04-15', prestamoOrigenId: 100, prestamoNuevoId: 101,
     capitalTrasladado: 900.13, dineroNuevoDesembolsado: 100.46, interesNuevo: 20.24, fechaLimiteContractualOrigen: null, diasGanados: null,
  });
  assert.deepEqual(result.resumen, {
    cantidadCadenas: 1, cantidadRefinanciamientos: 2,
      totalCapitalTrasladado: 1700.47, totalDineroNuevoDesembolsado: 301.02, montoRealmenteEntregado: 1301.02, montoRealmenteRecibido: 600.03, efectivoNetoRecuperado: -700.99, totalInteresNuevoPactado: 50.8, diasGanadosAcumulados: 0, diasGanadosCompletos: false,
  });
  assert.deepEqual(Object.keys(result.cadenas[0]), ['prestamoRaizId', 'prestamoTerminalId', 'fechaInicio', 'resumen', 'prestamos', 'transiciones']);
});

test('bulk endpoint calculates chain metrics once per loan, excludes independent loans, and preserves precision', async () => {
  const data = chainData(
    [chainLoan(1, '2026-01-01', 100.005), chainLoan(2, '2026-01-02', 200), chainLoan(3, '2026-01-03', 300), chainLoan(99, '2026-01-04', 999)],
    [chainRelation(1, 1, 2, '2026-02-01', 50, 20.005, 1), chainRelation(2, 2, 3, '2026-03-01', 60, 30.005, 1)],
    chainClient(),
    { 1: 10.005, 2: 20.005, 3: 30.005, 99: 999 },
  );
  const result = await new ObtenerCadenasClienteUseCase({ buscarDatosCadenasPorClienteId: async () => data }).execute(7);

  assert.equal(result.cadenas.length, 1);
  assert.deepEqual(result.cadenas[0].resumen, {
    cantidadPrestamos: 3, cantidadRefinanciamientos: 2, capitalInicial: 100.01, capitalTerminal: 300,
    totalCapitalTrasladado: 110, totalDineroNuevoDesembolsado: 50.02, montoRealmenteEntregado: 150.03,
    montoRealmenteRecibido: 60.03, efectivoNetoRecuperado: -90,
    totalInteresNuevoPactado: 2, diasGanadosAcumulados: 0, diasGanadosCompletos: false, fechaUltimoRefinanciamiento: '2026-03-01',
  });
  assert.equal(result.resumen.montoRealmenteEntregado, 150.03);
  assert.equal(result.resumen.montoRealmenteRecibido, 60.03);
  assert.equal(result.resumen.efectivoNetoRecuperado, -90);
});

test('bulk endpoint returns zero metrics when the client has no chains', async () => {
  const data = chainData([chainLoan(99, '2026-01-01', 999)], [], chainClient(), { 99: 999 });
  const result = await new ObtenerCadenasClienteUseCase({ buscarDatosCadenasPorClienteId: async () => data }).execute(7);
  assert.deepEqual(result.resumen, {
    cantidadCadenas: 0, cantidadRefinanciamientos: 0, totalCapitalTrasladado: 0, totalDineroNuevoDesembolsado: 0,
    montoRealmenteEntregado: 0, montoRealmenteRecibido: 0, efectivoNetoRecuperado: 0,
    totalInteresNuevoPactado: 0, diasGanadosAcumulados: 0, diasGanadosCompletos: true,
  });
});

test('bulk endpoint returns HTTP 404 semantics when the client does not exist', async () => {
  const useCase = new ObtenerCadenasClienteUseCase({ buscarDatosCadenasPorClienteId: async () => null });
  const controller = new RefinanciamientosController(null, null, null, useCase);

  await assert.rejects(() => controller.cadenasPorCliente(404), error => error.getStatus() === 404 && error.message === 'Cliente no encontrado.');
});

test('bulk endpoint rejects structural cycles and unreachable relation components', async () => {
  const data = chainData(
    [chainLoan(100, '2026-01-01', 100), chainLoan(101, '2026-01-02', 110)],
    [chainRelation(1, 100, 101, '2026-01-03', 90, 0, 5), chainRelation(2, 101, 100, '2026-01-04', 80, 0, 6)],
  );
  const useCase = new ObtenerCadenasClienteUseCase({ buscarDatosCadenasPorClienteId: async () => data });

  await assert.rejects(() => useCase.execute(7), error => error.getStatus() === 409 && /Corrupción estructural/.test(error.message));
});

test('bulk endpoint rejects a relation crossing client boundaries', async () => {
  const data = chainData(
    [chainLoan(100, '2026-01-01', 100, 7), chainLoan(101, '2026-01-02', 110, 8)],
    [chainRelation(1, 100, 101, '2026-01-03', 90, 0, 5, 8)],
  );
  const useCase = new ObtenerCadenasClienteUseCase({ buscarDatosCadenasPorClienteId: async () => data });

  await assert.rejects(() => useCase.execute(7), error => error.getStatus() === 409 && error.message === 'Relación de refinanciamiento cruzada entre clientes.');
});

test('bulk repository uses a constant four-query shape: client, loans, relations, and payment aggregate', async () => {
  const calls = { repositories: 0, client: 0, loans: 0, relations: 0 };
  let paymentState;
  const clientEntity = { id: 7, identificacion: '1-111-111', primerNombre: 'ANA', primerApellido: 'LOPEZ', fechaIngreso: new Date(), activo: true };
  const loanEntities = [{ id: 100, clienteId: 7, estado: 'ACTIVO', fechaAlta: '2026-01-01', capital: 100, interes: 20, montoTotal: 120, montoDesembolsado: 100 }];
  const relationEntities = [{ id: 1, prestamoOrigenId: 100, prestamoNuevoId: 101, fecha: '2026-02-01', capitalPendiente: 90, interesPendiente: 0, montoRefinanciado: 90, interesNuevo: 10, fechaCreacion: new Date(), prestamoOrigen: {}, prestamoNuevo: { montoDesembolsado: 0 } }];
  const relationQuery = {
    innerJoinAndSelect() { return this; }, where() { return this; }, orderBy() { return this; }, addOrderBy() { return this; },
    async getMany() { calls.relations += 1; return relationEntities; },
  };
  const paymentQuery = {
    select() { return this; }, addSelect() { return this; }, from() { return this; }, where() { return this; }, andWhere(_condition, parameters) { paymentState = parameters.estado; return this; }, groupBy() { return this; },
    async getRawMany() { calls.payments = (calls.payments || 0) + 1; return [{ prestamoId: '100', monto: '12.34' }]; },
  };
  const manager = {
    getRepository(entity) {
      calls.repositories += 1;
      if (entity.name === 'ClienteOrmEntity') return { findOne: async () => { calls.client += 1; return clientEntity; } };
      if (entity.name === 'PrestamoOrmEntity') return { find: async () => { calls.loans += 1; return loanEntities; } };
      throw new Error(`Unexpected repository: ${entity.name}`);
    },
    createQueryBuilder() { return paymentQuery; },
  };
  const repository = new RefinanciamientoTypeOrmRepository({ manager, createQueryBuilder: () => relationQuery });

  await repository.buscarDatosCadenasPorClienteId(7);
  assert.deepEqual(calls, { repositories: 2, client: 1, loans: 1, relations: 1, payments: 1 });
  assert.equal(paymentState, 'REGISTRADO', 'ANULADO payments must be excluded by the aggregate query');
});
