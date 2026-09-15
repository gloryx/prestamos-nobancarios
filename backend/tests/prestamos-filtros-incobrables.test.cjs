const test = require('node:test');
const assert = require('node:assert/strict');
const { PrestamoTypeOrmRepository } = require('../dist/modules/prestamos/infrastructure/persistence/typeorm/prestamo.typeorm-repository');

function queryForList(calls) {
  return {
    leftJoinAndSelect(...args) { calls.push(['join', ...args]); return this; },
    andWhere(...args) { calls.push(['andWhere', ...args]); return this; },
    orderBy(...args) { calls.push(['orderBy', ...args]); return this; },
    addOrderBy(...args) { calls.push(['addOrderBy', ...args]); return this; },
    skip(value) { calls.push(['skip', value]); return this; },
    take(value) { calls.push(['take', value]); return this; },
    async getManyAndCount() { return [[], 0]; },
  };
}

function setupList() {
  const calls = [];
  const repository = Object.create(PrestamoTypeOrmRepository.prototype);
  repository.repository = {
    createQueryBuilder: () => queryForList(calls),
    manager: { createQueryBuilder: () => queryForList(calls) },
  };
  return { repository, calls };
}

function conditionsFrom(call) {
  const conditions = [];
  call[1].whereFactory({
    where(...args) { conditions.push(['where', ...args]); return this; },
    orWhere(...args) { conditions.push(['orWhere', ...args]); return this; },
  });
  return conditions;
}

test('loan search follows the client selector fields and preserves normalized terms and pagination', async () => {
  const { repository, calls } = setupList();
  await repository.listar({ pagina: 2, limite: 25, buscar: ' Ana   Pérez ', estado: 'ACTIVO' });

  const searchCalls = calls.filter(([kind, value]) => kind === 'andWhere' && value?.whereFactory);
  assert.equal(searchCalls.length, 2);
  const conditions = conditionsFrom(searchCalls[0]);
  assert.match(conditions[0][1], /CONCAT_WS/);
  assert.match(conditions.map(([, expression]) => expression).join(' '), /cliente\.identificacion/);
  assert.match(conditions.map(([, expression]) => expression).join(' '), /cliente\.telefono1/);
  assert.match(conditions.map(([, expression]) => expression).join(' '), /cliente\.telefono2/);
  assert.match(conditions.map(([, expression]) => expression).join(' '), /cliente\.direccion/);
  assert.equal(conditions[0][2].buscarTerm0, '%Ana%');
  assert.equal(conditionsFrom(searchCalls[1])[0][2].buscarTerm1, '%Pérez%');
  assert.deepEqual(calls.filter(([kind]) => kind === 'skip' || kind === 'take'), [['skip', 25], ['take', 25]]);
  assert.ok(calls.some(([kind, expression]) => kind === 'andWhere' && expression === 'prestamo.estado = :estado'));
});

test('loan summary uses registered payments and the financial monto_total balance', async () => {
  const calls = [];
  const subquery = {
    select(...args) { calls.push(['sub', ...args]); return this; },
    addSelect(...args) { calls.push(['subAdd', ...args]); return this; },
    from(...args) { calls.push(['subFrom', ...args]); return this; },
    where(...args) { calls.push(['subWhere', ...args]); return this; },
    groupBy(...args) { calls.push(['subGroup', ...args]); return this; },
    getQuery() { return 'SELECT pago.prestamo_id, SUM(pago.monto) recuperado FROM pago pago GROUP BY pago.prestamo_id'; },
  };
  const query = {
    andWhere(...args) { calls.push(['andWhere', ...args]); return this; },
    leftJoin(...args) { calls.push(['leftJoin', ...args]); return this; },
    select(...args) { calls.push(['select', ...args]); return this; },
    addSelect(...args) { calls.push(['addSelect', ...args]); return this; },
    async getRawOne() { return { total: '3', prestado: '300', ganancia: '30', recuperado: '100', pendiente: '250' }; },
  };
  const repository = Object.create(PrestamoTypeOrmRepository.prototype);
  repository.repository = { manager: { createQueryBuilder: () => ({ subQuery: () => subquery }) }, createQueryBuilder: () => query };

  const result = await repository.resumen({ pagina: 1, limite: 10, estados: ['INCOBRABLE'], buscar: '555', direccion: 'Centro' });
  assert.deepEqual(result, { total: 3, prestado: 300, ganancia: 30, recuperado: 100, pendiente: 250 });
  assert.ok(calls.some(([kind, value]) => kind === 'subWhere' && value.includes("pago.estado = 'REGISTRADO'")));
  assert.ok(calls.some(([kind, value]) => kind === 'addSelect' && value.includes('prestamo.monto_total')));
  assert.ok(calls.some(([kind, value]) => kind === 'andWhere' && value === 'prestamo.estado IN (:...estados)'));
});
