const test = require('node:test');
const assert = require('node:assert/strict');
const { PrestamoTypeOrmRepository } = require('../dist/modules/prestamos/infrastructure/persistence/typeorm/prestamo.typeorm-repository');

function repositoryWith(raw) {
  const calls = [];
  const subquery = {
    select(...args) { calls.push(['subselect', ...args]); return this; },
    addSelect(...args) { calls.push(['subaddSelect', ...args]); return this; },
    from(...args) { calls.push(['from', ...args]); return this; },
    where(...args) { calls.push(['subwhere', ...args]); return this; },
    andWhere(...args) { calls.push(['subandWhere', ...args]); return this; },
    groupBy(...args) { calls.push(['groupBy', ...args]); return this; },
    getQuery() { return 'SELECT pago.prestamo_id, SUM(pago.monto) AS recuperado FROM pago pago GROUP BY pago.prestamo_id'; },
  };
  const query = {
    andWhere(...args) { calls.push(['andWhere', ...args]); return this; },
    leftJoin(...args) { calls.push(['leftJoin', ...args]); return this; },
    select(...args) { calls.push(['select', ...args]); return this; },
    addSelect(...args) { calls.push(['addSelect', ...args]); return this; },
    async getRawOne() { return raw; },
  };
  const repository = Object.create(PrestamoTypeOrmRepository.prototype);
  repository.repository = { manager: { createQueryBuilder: () => ({ subQuery: () => subquery }) }, createQueryBuilder: () => query };
  return { repository, calls };
}

test('summary returns zero recovered for loans without payments and clamps pending', async () => {
  const { repository, calls } = repositoryWith({ total: '1', prestado: '100.00', ganancia: '20.00', recuperado: '0.00', pendiente: '120.00' });
  assert.deepEqual(await repository.resumen({ pagina: 1, limite: 10, estados: ['ACTIVO'], fechaInicio: '2026-01-01', fechaFin: '2026-01-31' }), { total: 1, prestado: 100, ganancia: 20, recuperado: 0, pendiente: 120 });
  assert.ok(calls.some(([kind, value]) => kind === 'subaddSelect' && value === 'SUM(pago.monto)'));
  assert.ok(calls.some(([kind, value]) => kind === 'addSelect' && String(value).includes('GREATEST')));
});

test('summary preserves aggregate values for multiple payments without duplicating loan amounts', async () => {
  const { repository } = repositoryWith({ total: '2', prestado: '300.00', ganancia: '30.00', recuperado: '250.00', pendiente: '80.00' });
  assert.deepEqual(await repository.resumen({ pagina: 4, limite: 1, estados: ['ACTIVO', 'CANCELADO'], buscar: 'Ana', direccion: 'Centro', fechaInicio: '2026-02-01', fechaFin: '2026-02-28' }), { total: 2, prestado: 300, ganancia: 30, recuperado: 250, pendiente: 80 });
});
