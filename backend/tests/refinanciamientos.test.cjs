const assert = require('node:assert/strict');
const test = require('node:test');

const { ConflictException } = require('@nestjs/common');
const { RefinanciamientoQueries } = require('../dist/modules/refinanciamientos/application/use-cases/refinanciamiento-queries.use-cases');
const { CrearRefinanciamientoUseCase } = require('../dist/modules/refinanciamientos/application/use-cases/crear-refinanciamiento.use-case');
const { EstadoPrestamo } = require('../dist/modules/prestamos/domain/enums/estado-prestamo.enum');

const relation = (id, prestamoOrigenId, prestamoNuevoId) => ({
  id,
  prestamoOrigenId,
  prestamoNuevoId,
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
  const queryBuilder = {
    leftJoinAndSelect() { return this; },
    where() { return this; },
    setLock(mode) { lockMode = mode; return this; },
    async getOne() { return { id: 100, estado: EstadoPrestamo.ACTIVO }; },
  };
  const dataSource = {
    async transaction(callback) {
      return callback({
        getRepository(entity) {
          if (entity.name === 'PrestamoOrmEntity') return { createQueryBuilder: () => queryBuilder };
          if (entity.name === 'RefinanciamientoOrmEntity') return { count: async () => 0 };
          throw new Error(`Unexpected repository: ${entity.name}`);
        },
      });
    },
  };

  await assert.rejects(
    () => new CrearRefinanciamientoUseCase(dataSource, { validarActor: async () => {} }).execute({ prestamoOrigenId: 100 }, 1),
    /Unexpected repository/,
  );
  assert.equal(lockMode, 'pessimistic_write');
});
