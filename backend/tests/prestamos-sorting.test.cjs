const test = require('node:test');
const assert = require('node:assert/strict');

const Repository = require('../dist/modules/prestamos/infrastructure/persistence/typeorm/prestamo.typeorm-repository').PrestamoTypeOrmRepository;

function setup(supportAliases = false, listedEntities = [], listedRaw = []) {
  const calls = [];
  const filters = [];
  const countOrder = [];
  const selects = [];
  const qb = {
    where(...args) { filters.push(['where', ...args]); return this; }, andWhere(...args) { filters.push(['andWhere', ...args]); return this; }, leftJoinAndSelect() { return this; },
    leftJoin() { return this; }, setParameter() { return this; }, setParameters() { return this; },
    orderBy(...args) { calls.push(['orderBy', ...args]); return this; },
    addOrderBy(...args) { calls.push(['addOrderBy', ...args]); return this; },
    skip(value) { calls.push(['skip', value]); return this; }, take(value) { calls.push(['take', value]); return this; },
     async getManyAndCount() { return [[], 0]; }, async getRawAndEntities() { calls.push(['getRawAndEntities']); return { entities: listedEntities, raw: listedRaw }; }, async getCount() { countOrder.push('getCount'); return 0; }, clone() { return this; },
  };
  if (supportAliases) qb.addSelect = function(...args) { selects.push(args); return this; };
  const repository = Object.create(Repository.prototype);
  const aggregate = { select() { return this; }, addSelect() { return this; }, from() { return this; }, where() { return this; }, andWhere() { return this; }, groupBy() { return this; }, getQuery() { return 'SELECT pago.prestamo_id, SUM(pago.monto) AS total_pagado FROM pago pago GROUP BY pago.prestamo_id'; }, getParameters() { return {}; }, async getRawMany() { return []; } };
  repository.repository = { createQueryBuilder: () => qb, manager: { createQueryBuilder: () => aggregate } };
  return { repository, calls, filters, selects, countOrder };
}

const expected = {
  id: ['prestamo.id'], cliente: ["UPPER(TRIM(CONCAT_WS(' ', cliente.primer_nombre, cliente.segundo_nombre, cliente.primer_apellido, cliente.segundo_apellido)))"],
  direccion: ['cliente.direccion'], fechaAlta: ['prestamo.fecha_alta'], capital: ['prestamo.capital'],
  estado: ["CASE prestamo.estado WHEN 'ACTIVO' THEN 1 WHEN 'INCOBRABLE' THEN 2 WHEN 'REFINANCIADO' THEN 3 WHEN 'CANCELADO' THEN 4 END"],
};

for (const field of Object.keys(expected)) for (const direction of ['ASC', 'DESC']) test(`${field} ${direction} is whitelisted and ordered before pagination`, async () => {
  const { repository, calls } = setup();
  await repository.listar({ pagina: 2, limite: 10, ordenarPor: field, direccionOrden: direction });
  assert.equal(calls[0][0], 'orderBy'); assert.equal(calls[0][1], expected[field][0]); assert.equal(calls[0][2], direction);
   if (field !== 'id') assert.deepEqual(calls[1], ['addOrderBy', 'prestamo.id', field === 'fechaAlta' ? direction : 'DESC']);
  assert.ok(calls.findIndex(call => call[0] === 'skip') > 0);
});

test('default order is unchanged', async () => {
  const { repository, calls } = setup(); await repository.listar({ pagina: 1, limite: 10 });
  assert.deepEqual(calls.slice(0, 2), [['orderBy', 'prestamo.fecha_alta', 'DESC'], ['addOrderBy', 'prestamo.id', 'DESC']]);
});

test('cancelled listings select the latest transition to CANCELADO in bulk and default to its date', async () => {
  const { repository, calls, selects } = setup(true);
  await repository.listar({ pagina: 1, limite: 10, estados: ['CANCELADO'] });
  assert.equal(calls.filter((call) => call[0] === 'getRawAndEntities').length, 1);
  assert.equal(selects.filter((select) => ['fecha_cancelacion_orden', 'cancelacion_fecha', 'cancelacion_usuario_id', 'cancelacion_usuario_nombre'].includes(select[1])).length, 4);
  assert.deepEqual(calls.slice(0, 2), [['orderBy', 'fecha_cancelacion_orden', 'DESC', 'NULLS LAST'], ['addOrderBy', 'prestamo.id', 'DESC']]);
});

test('cancelled history accepts ACTIVO and INCOBRABLE predecessors and uses the latest date/id', () => {
  const source = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../src/modules/prestamos/infrastructure/persistence/typeorm/prestamo.typeorm-repository.ts'), 'utf8');
  const cancellationQueries = source.match(/SELECT [\s\S]*?estado_nuevo = 'CANCELADO'[\s\S]*?LIMIT 1\)/g) ?? [];
  assert.ok(cancellationQueries.length >= 1);
  for (const query of cancellationQueries) {
    assert.doesNotMatch(query, /estado_anterior\s*=\s*'ACTIVO'/);
    assert.match(query, /ORDER BY h\.fecha DESC, h\.id DESC LIMIT 1/);
  }
});

test('real cancellation date range filters the latest CANCELADO transition before pagination', async () => {
  const { repository, calls, filters, countOrder } = setup(true);
  await repository.listar({ pagina: 3, limite: 10, estados: ['CANCELADO'], buscar: 'Ana', fechaInicio: '2026-01-01', fechaFin: '2026-12-31', fechaCancelacionDesde: '2026-09-01', fechaCancelacionHasta: '2026-09-30' });
  const dateFilters = filters.filter(([kind, expression]) => kind === 'andWhere' && String(expression).includes('prestamo_estado_historial'));
  assert.equal(dateFilters.length, 2);
  assert.match(String(dateFilters[0][1]), /estado_nuevo = 'CANCELADO'/);
  assert.match(String(dateFilters[0][1]), /ORDER BY h\.fecha DESC, h\.id DESC LIMIT 1/);
  assert.match(String(dateFilters[1][1]), /INTERVAL '1 day'/);
  assert.deepEqual(countOrder, ['getCount']);
  assert.ok(calls.findIndex((call) => call[0] === 'skip') >= 0);
});

test('cancellation date filters are optional and preserve search, state, and date-alta filters', async () => {
  const { repository, calls, filters } = setup(true);
  await repository.listar({ pagina: 1, limite: 10, estado: 'CANCELADO', buscar: '555', fechaInicio: '2026-01-01', fechaFin: '2026-01-31' });
  assert.equal(filters.some(([kind, expression]) => kind === 'andWhere' && String(expression).includes('prestamo_estado_historial')), false);
  assert.ok(filters.some(([kind, expression]) => kind === 'andWhere' && typeof expression === 'object'));
  assert.ok(filters.some(([kind, expression]) => kind === 'andWhere' && expression === 'prestamo.fecha_alta >= :fechaInicio'));
  assert.ok(filters.some(([kind, expression]) => kind === 'andWhere' && expression === 'prestamo.fecha_alta <= :fechaFin'));
});

for (const rangeFilters of [
  { fechaCancelacionDesde: '2026-09-01' },
  { fechaCancelacionHasta: '2026-09-30' },
]) test(`cancellation range supports ${Object.keys(rangeFilters)[0]} without the other bound`, async () => {
  const { repository, filters } = setup(true);
  await repository.listar({ pagina: 1, limite: 10, estados: ['CANCELADO'], ...rangeFilters });
  assert.equal(filters.filter(([kind, expression]) => kind === 'andWhere' && String(expression).includes('prestamo_estado_historial')).length, 1);
});

test('cancellation filter DTO accepts from, until, both inclusive values and rejects invalid dates', async () => {
  const { ValidationPipe } = require('@nestjs/common');
  const { FiltrosPrestamosDto } = require('../dist/modules/prestamos/application/dto/filtros-prestamos.dto');
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  const dto = await pipe.transform({ fechaCancelacionDesde: '2026-09-01', fechaCancelacionHasta: '2026-09-30' }, { type: 'query', metatype: FiltrosPrestamosDto });
  assert.equal(dto.fechaCancelacionDesde, '2026-09-01');
  assert.equal(dto.fechaCancelacionHasta, '2026-09-30');
  await assert.rejects(() => pipe.transform({ fechaCancelacionDesde: '2026-09-31' }, { type: 'query', metatype: FiltrosPrestamosDto }));
});

test('cancelled listing maps transition date and actor without changing financial fields', async () => {
  const entity = { id: 7, clienteId: 1, periodicidadPagoId: 1, formaPagoId: 1, formaDesembolsoId: null, fechaAlta: '2026-01-01', capital: 100, interes: 20, montoTotal: 120, montoDesembolsado: 100, cantidadPagos: 1, planPersonalizado: false, estado: 'CANCELADO', observaciones: null, fechaCreacion: new Date(), fechaActualizacion: new Date(), cliente: { id: 1, primerNombre: 'Ana', primerApellido: 'Pérez', identificacion: '1', direccion: null, telefono1: '8888' }, periodicidadPago: { id: 1, nombre: 'MENSUAL' }, formaPago: { id: 1, nombre: 'EFECTIVO' }, formaDesembolso: null };
  const raw = [{ cancelacion_fecha: '2026-12-31', cancelacion_usuario_id: '3', cancelacion_usuario_nombre: 'Luis Mora' }];
  const { repository } = setup(true, [entity], raw);
  const result = await repository.listar({ pagina: 1, limite: 10, estados: ['CANCELADO'] });
  assert.equal(result.datos[0].fechaCancelacion, '2026-12-31');
  assert.deepEqual(result.datos[0].usuarioCancelacion, { id: 3, nombreCompleto: 'Luis Mora' });
  assert.equal(result.datos[0].montoTotal, 120);
});

for (const rawDate of [new Date(2026, 8, 9), '2026-09-09 00:00:00']) test(`cancelled listing serializes ${rawDate instanceof Date ? 'Date' : 'SQL string'} as its calendar date`, async () => {
  if (rawDate instanceof Date) assert.equal(String(rawDate).slice(0, 10), 'Wed Sep 09');
  const entity = { id: 7, clienteId: 1, periodicidadPagoId: 1, formaPagoId: 1, formaDesembolsoId: null, fechaAlta: '2026-01-01', capital: 100, interes: 20, montoTotal: 120, montoDesembolsado: 100, cantidadPagos: 1, planPersonalizado: false, estado: 'CANCELADO', observaciones: null, fechaCreacion: new Date(), fechaActualizacion: new Date(), cliente: { id: 1, primerNombre: 'Ana', primerApellido: 'Pérez', identificacion: '1', direccion: null, telefono1: '8888' }, periodicidadPago: { id: 1, nombre: 'MENSUAL' }, formaPago: { id: 1, nombre: 'EFECTIVO' }, formaDesembolso: null };
  const { repository } = setup(true, [entity], [{ cancelacion_fecha: rawDate }]);
  const result = await repository.listar({ pagina: 1, limite: 10, estados: ['CANCELADO'] });
  assert.equal(result.datos[0].fechaCancelacion, '2026-09-09');
});

test('address uses NULLS LAST and stable tie-break', async () => {
  const { repository, calls } = setup(); await repository.listar({ pagina: 1, limite: 10, ordenarPor: 'direccion', direccionOrden: 'DESC' });
  assert.deepEqual(calls.slice(0, 2), [['orderBy', 'cliente.direccion', 'DESC', 'NULLS LAST'], ['addOrderBy', 'prestamo.id', 'DESC']]);
});

for (const direction of ['ASC', 'DESC']) test(`fechaAlta uses the same direction for its id tie-break (${direction})`, async () => {
  const { repository, calls } = setup();
  await repository.listar({ pagina: 1, limite: 10, ordenarPor: 'fechaAlta', direccionOrden: direction });
  assert.deepEqual(calls.slice(0, 2), [['orderBy', 'prestamo.fecha_alta', direction], ['addOrderBy', 'prestamo.id', direction]]);
});

test('filters remain applied with sorting and pagination', async () => {
  const { repository, calls } = setup(); await repository.listar({ pagina: 3, limite: 25, buscar: 'ana', direccion: 'sur', estados: ['ACTIVO'], fechaInicio: '2026-01-01', fechaFin: '2026-12-31', ordenarPor: 'capital', direccionOrden: 'ASC' });
  assert.deepEqual(calls.slice(-2), [['skip', 50], ['take', 25]]);
});

for (const direction of ['ASC', 'DESC']) test(`saldoPendiente ${direction} uses the payment aggregate before pagination`, async () => {
  const { repository, calls } = setup(true);
  await repository.listar({ pagina: 2, limite: 10, ordenarPor: 'saldoPendiente', direccionOrden: direction });
  assert.deepEqual(calls.slice(0, 3), [['orderBy', 'saldo_pendiente_orden', direction], ['addOrderBy', 'prestamo.id', direction], ['skip', 10]]);
});

for (const direction of ['ASC', 'DESC']) test(`indicadorCobranza ${direction} uses candidate priority before pagination`, async () => {
  const { repository, calls, selects } = setup(true);
  await repository.listar({ pagina: 2, limite: 10, ordenarPor: 'indicadorCobranza', direccionOrden: direction, candidateIds: [3, 2, 1] });
  assert.equal(selects[0][1], 'cobranza_sort');
  assert.match(selects[0][0], /^CASE /);
  assert.equal(calls[0][0], 'orderBy');
  assert.deepEqual(calls.slice(0, 2), [['orderBy', 'cobranza_sort', direction], ['addOrderBy', 'prestamo.id', direction]]);
  assert.equal(calls.some((call) => call[0] === 'orderBy' && /^CASE /.test(call[1])), false);
  assert.deepEqual(calls.slice(-2), [['skip', 10], ['take', 10]]);
});

test('invalid sort values and cobranza are rejected by the DTO whitelist', async () => {
  const { ValidationPipe } = require('@nestjs/common');
  const { FiltrosPrestamosDto } = require('../dist/modules/prestamos/application/dto/filtros-prestamos.dto');
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  await assert.rejects(() => pipe.transform({ ordenarPor: 'cobranza' }, { type: 'query', metatype: FiltrosPrestamosDto }));
  await pipe.transform({ ordenarPor: 'saldoPendiente', direccionOrden: 'DESC' }, { type: 'query', metatype: FiltrosPrestamosDto });
  await pipe.transform({ ordenarPor: 'indicadorCobranza', direccionOrden: 'ASC' }, { type: 'query', metatype: FiltrosPrestamosDto });
  await assert.rejects(() => pipe.transform({ direccionOrden: 'sideways' }, { type: 'query', metatype: FiltrosPrestamosDto }));
});
