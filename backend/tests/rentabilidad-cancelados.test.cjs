const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularRentabilidadCancelados } = require('../dist/modules/prestamos/application/use-cases/calcular-rentabilidad-cancelados');
const { RentabilidadCanceladosTypeOrmRepository } = require('../dist/modules/prestamos/infrastructure/persistence/typeorm/rentabilidad-cancelados.typeorm-repository');

const fact = (capital, ganancia, alta, cancelacion) => ({ capital, ganancia, fechaAlta: alta, fechaCancelacion: cancelacion });

test('calculates total return and equivalent 30-day rate from real interest', () => {
  const result = calcularRentabilidadCancelados([fact(150000, 30000, '2026-07-01', '2026-08-15')]);
  assert.equal(result.resumen.rentabilidadTotal, 20);
  assert.equal(result.resumen.tasa30Dias, 13.33);
});

test('uses calendar durations of 30 and 60 days and coherent groups', () => {
  const result = calcularRentabilidadCancelados([
    fact(100000, 10000, '2026-01-01', '2026-01-31'),
    fact(100000, 20000, '2026-01-01', '2026-03-02'),
  ]);
  assert.equal(result.porPlazo.find((row) => row.plazo === '16–30 días').cantidad, 1);
  assert.equal(result.porPlazo.find((row) => row.plazo === '46–60 días').cantidad, 1);
  assert.equal(result.resumen.tasa30Dias, 10);
});

test('weights the monthly rate by capital instead of averaging loan rates', () => {
  const result = calcularRentabilidadCancelados([
    fact(100000, 10000, '2026-01-01', '2026-01-31'),
    fact(300000, 90000, '2026-01-01', '2026-03-02'),
  ]);
  assert.equal(result.resumen.tasa30Dias, 13.75);
});

test('includes zero realized interest and excludes invalid durations only from temporal metrics', () => {
  const result = calcularRentabilidadCancelados([
    fact(100000, 0, '2026-02-01', '2026-02-01'),
    fact(200000, 20000, '2026-02-01', '2026-02-11'),
  ]);
  assert.equal(result.resumen.prestamosCancelados, 2);
  assert.equal(result.resumen.capitalTotal, 300000);
  assert.equal(result.metadata.registrosSinDuracionValida, 1);
  assert.equal(result.metadata.registrosConDuracionValida, 1);
});

test('returns safe zero values for an empty month', () => {
  const result = calcularRentabilidadCancelados([]);
  assert.deepEqual(result.resumen, { prestamosCancelados: 0, capitalTotal: 0, gananciaTotal: 0, rentabilidadTotal: 0, tasa30Dias: 0 });
  assert.equal(result.porPlazo.length, 5);
  assert.ok(result.porPlazo.every((row) => Number.isFinite(row.tasa30Dias)));
});

test('serializes repository dates without Date string or UTC calendar shifts', async () => {
  const rawRows = [{ capital: '100000', ganancia: '10000', fechaAlta: new Date(2026, 0, 1), fechaCancelacion: new Date(2026, 1, 15) }, { capital: '200000', ganancia: '20000', fechaAlta: '2026-03-01', fechaCancelacion: '2026-04-02T00:00:00.000Z' }];
  const queryBuilder = { from() { return this; }, innerJoin() { return this; }, leftJoin() { return this; }, select() { return this; }, addSelect() { return this; }, where() { return this; }, andWhere() { return this; }, setParameters() { return this; }, getRawMany: async () => rawRows };
  const repository = new RentabilidadCanceladosTypeOrmRepository({ createQueryBuilder: () => queryBuilder });
  assert.deepEqual(await repository.listar(2026, 2), [
    { capital: 100000, ganancia: 10000, fechaAlta: '2026-01-01', fechaCancelacion: '2026-02-15' },
    { capital: 200000, ganancia: 20000, fechaAlta: '2026-03-01', fechaCancelacion: '2026-04-02' },
  ]);
});
