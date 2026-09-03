const test = require('node:test');
const assert = require('node:assert/strict');
const { InitialFormasPagoSeed, DEFAULT_FORMAS_PAGO } = require('../dist/modules/formas-pago/application/initial-formas-pago.seed');
const { InitialPeriodicidadesPagoSeed, DEFAULT_PERIODICIDADES_PAGO } = require('../dist/modules/periodicidades-pago/application/initial-periodicidades-pago.seed');
const { InitialIngresosSeed } = require('../dist/modules/ingresos/application/initial-ingresos.seed');

const repo = () => {
  const values = [];
  return {
    values,
    buscarPorNombre: async name => values.find(value => value.nombre === name.trim().toUpperCase()) ?? null,
    guardar: async value => { values.push(value); return value; },
  };
};
const creator = repository => ({ execute: async input => {
  const name = typeof input === 'string' ? input : input.nombre;
  if (await repository.buscarPorNombre(name)) { const error = new Error('duplicate'); error.name = 'ConflictException'; throw error; }
  const value = { id: repository.values.length + 1, nombre: name.trim().toUpperCase(), activo: true };
  return repository.guardar(value);
} });

test('periodicities are seeded in the requested order', async () => {
  const repository = repo();
  await new InitialPeriodicidadesPagoSeed(repository, creator(repository)).seed();
  assert.deepEqual(repository.values.map(value => value.nombre), DEFAULT_PERIODICIDADES_PAGO);
});
test('periodicities tolerate a partially seeded catalog', async () => {
  const repository = repo(); repository.values.push({ nombre: 'SEMANAL' });
  await new InitialPeriodicidadesPagoSeed(repository, creator(repository)).seed();
  assert.deepEqual(repository.values.map(value => value.nombre), ['SEMANAL', 'DIARIO', 'QUINCENAL', 'MENSUAL']);
});
test('periodicities are idempotent and preserve existing rows', async () => {
  const repository = repo(); const existing = { id: 77, nombre: 'DIARIO', activo: false }; repository.values.push(existing);
  const seed = new InitialPeriodicidadesPagoSeed(repository, creator(repository)); await seed.seed(); await seed.seed();
  assert.equal(repository.values.filter(value => value.nombre === 'DIARIO').length, 1); assert.deepEqual(repository.values[0], existing);
});
test('periodicity database errors are propagated', async () => {
  const repository = repo(); const error = new Error('database unavailable');
  const failing = { execute: async () => { throw error; } };
  await assert.rejects(() => new InitialPeriodicidadesPagoSeed(repository, failing).seed(), error);
});
test('payment methods are seeded in the requested order', async () => {
  const repository = repo(); await new InitialFormasPagoSeed(repository, creator(repository)).seed();
  assert.deepEqual(repository.values.map(value => value.nombre), DEFAULT_FORMAS_PAGO);
});
test('payment methods match names normalized by the domain', async () => {
  const repository = repo(); repository.values.push({ id: 9, nombre: 'SINPE MÓVIL', activo: false });
  await new InitialFormasPagoSeed(repository, creator(repository)).seed();
  assert.equal(repository.values.filter(value => value.nombre === 'SINPE MÓVIL').length, 1); assert.equal(repository.values[0].activo, false);
});
test('payment methods tolerate partial catalogs and remain idempotent', async () => {
  const repository = repo(); repository.values.push({ nombre: 'OTRO' }); const seed = new InitialFormasPagoSeed(repository, creator(repository));
  await seed.seed(); await seed.seed(); assert.equal(repository.values.length, DEFAULT_FORMAS_PAGO.length);
});
test('payment method database errors are propagated', async () => {
  const repository = repo(); const error = new Error('database unavailable');
  await assert.rejects(() => new InitialFormasPagoSeed(repository, { execute: async () => { throw error; } }).seed(), error);
});
test('all six income sources are seeded without creating income records', async () => {
  const repository = repo(); const incomeWrites = []; const seed = new InitialIngresosSeed(repository, { execute: async name => { incomeWrites.push(name); return creator(repository).execute(name); } });
  await seed.seed(); assert.deepEqual(repository.values.map(value => value.nombre), ['SALARIO DOCENTE', 'ALQUILERES', 'INTERESES PRESTAMOS', 'ALQUILER PARA EVENTOS', 'CONFECCION DE PIJAMAS', 'OTROS']); assert.deepEqual(incomeWrites, repository.values.map(value => value.nombre));
});
test('income source errors are not converted into success', async () => {
  const repository = repo(); const error = new Error('database unavailable');
  await assert.rejects(() => new InitialIngresosSeed(repository, { execute: async () => { throw error; } }).seed(), error);
});
