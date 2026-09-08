const test = require('node:test');
const assert = require('node:assert/strict');

const Repository = require('../dist/modules/clientes/infrastructure/persistence/typeorm/cliente.typeorm-repository').ClienteTypeOrmRepository;

function setup({ alias = false } = {}) {
  const calls = [];
  const qb = {
    andWhere(...args) { calls.push(['andWhere', ...args]); return this; },
    orderBy(...args) { calls.push(['orderBy', ...args]); return this; },
    addOrderBy(...args) { calls.push(['addOrderBy', ...args]); return this; },
    skip(value) { calls.push(['skip', value]); return this; },
    take(value) { calls.push(['take', value]); return this; },
    async getManyAndCount() { calls.push(['getManyAndCount']); return [[], 0]; },
  };
  if (alias) qb.addSelect = function (...args) { calls.push(['addSelect', ...args]); return this; };
  const repository = Object.create(Repository.prototype);
  repository.repository = { createQueryBuilder: () => qb };
  return { repository, calls };
}

const fields = {
  identificacion: 'cliente.identificacion',
  direccion: 'cliente.direccion',
  telefono: 'cliente.telefono1',
  estado: 'cliente.activo',
};

for (const [field, column] of Object.entries(fields)) for (const direction of ['ASC', 'DESC']) test(`${field} ${direction} is ordered before pagination`, async () => {
  const { repository, calls } = setup();
  await repository.listar({ pagina: 2, limite: 10, ordenarPor: field, direccionOrden: direction });
  assert.deepEqual(calls.slice(0, 3), [
    ['orderBy', column, direction, ...(field === 'direccion' ? ['NULLS LAST'] : [])],
    ['addOrderBy', 'cliente.id', 'DESC'],
    ['skip', 10],
  ]);
  assert.deepEqual(calls.at(-2), ['take', 10]);
  assert.deepEqual(calls.at(-1), ['getManyAndCount']);
});

for (const direction of ['ASC', 'DESC']) test(`name ${direction} uses a safe TypeORM select alias and stable id tie-break`, async () => {
  const { repository, calls } = setup({ alias: true });
  await repository.listar({ pagina: 1, limite: 25, ordenarPor: 'nombre', direccionOrden: direction });
  assert.equal(calls[0][0], 'addSelect');
  assert.deepEqual(calls[1], ['orderBy', 'cliente_nombre_orden', direction]);
  assert.deepEqual(calls[2], ['addOrderBy', 'cliente.id', 'DESC']);
  assert.ok(calls.findIndex(call => call[0] === 'skip') > calls.findIndex(call => call[0] === 'addOrderBy'));
});

test('default order remains unchanged', async () => {
  const { repository, calls } = setup();
  await repository.listar({ pagina: 1, limite: 10 });
  assert.deepEqual(calls.slice(0, 2), [
    ['orderBy', 'cliente.primer_apellido', 'ASC'],
    ['addOrderBy', 'cliente.primer_nombre', 'ASC'],
  ]);
});

test('filters, sorting and pagination are applied together', async () => {
  const { repository, calls } = setup();
  await repository.listar({ pagina: 3, limite: 25, buscar: 'ana', direccion: 'sur', activo: true, ordenarPor: 'direccion', direccionOrden: 'ASC' });
  assert.deepEqual(calls.map(call => call[0]), ['andWhere', 'andWhere', 'andWhere', 'orderBy', 'addOrderBy', 'skip', 'take', 'getManyAndCount']);
  assert.deepEqual(calls.slice(-3), [
    ['skip', 50],
    ['take', 25],
    ['getManyAndCount'],
  ]);
});

test('all visible columns are whitelisted and fechaIngreso is not sortable', async () => {
  const { repository, calls } = setup();
  await repository.listar({ pagina: 1, limite: 10, ordenarPor: 'fechaIngreso', direccionOrden: 'ASC' });
  assert.deepEqual(calls.slice(0, 2), [
    ['orderBy', 'cliente.primer_apellido', 'ASC'],
    ['addOrderBy', 'cliente.primer_nombre', 'ASC'],
  ]);
});

test('invalid sort values are rejected by the DTO whitelist', async () => {
  const { ValidationPipe } = require('@nestjs/common');
  const { FiltrosClientesDto } = require('../dist/modules/clientes/application/dto/filtros-clientes.dto');
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  await assert.rejects(() => pipe.transform({ ordenarPor: 'correo' }, { type: 'query', metatype: FiltrosClientesDto }));
  await assert.rejects(() => pipe.transform({ ordenarPor: 'fechaIngreso' }, { type: 'query', metatype: FiltrosClientesDto }));
  await assert.rejects(() => pipe.transform({ direccionOrden: 'sideways' }, { type: 'query', metatype: FiltrosClientesDto }));
});
