const test = require('node:test');
const assert = require('node:assert/strict');

const Repository = require('../dist/modules/prestamos/infrastructure/persistence/typeorm/prestamo.typeorm-repository').PrestamoTypeOrmRepository;

function setup(supportAliases = false) {
  const calls = [];
  const selects = [];
  const qb = {
    where() { return this; }, andWhere() { return this; }, leftJoinAndSelect() { return this; },
    leftJoin() { return this; }, setParameter() { return this; }, setParameters() { return this; },
    orderBy(...args) { calls.push(['orderBy', ...args]); return this; },
    addOrderBy(...args) { calls.push(['addOrderBy', ...args]); return this; },
    skip(value) { calls.push(['skip', value]); return this; }, take(value) { calls.push(['take', value]); return this; },
    async getManyAndCount() { return [[], 0]; },
  };
  if (supportAliases) qb.addSelect = function(...args) { selects.push(args); return this; };
  const repository = Object.create(Repository.prototype);
  const aggregate = { select() { return this; }, addSelect() { return this; }, from() { return this; }, where() { return this; }, andWhere() { return this; }, groupBy() { return this; }, getQuery() { return 'SELECT pago.prestamo_id, SUM(pago.monto) AS total_pagado FROM pago pago GROUP BY pago.prestamo_id'; }, getParameters() { return {}; }, async getRawMany() { return []; } };
  repository.repository = { createQueryBuilder: () => qb, manager: { createQueryBuilder: () => aggregate } };
  return { repository, calls, selects };
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
