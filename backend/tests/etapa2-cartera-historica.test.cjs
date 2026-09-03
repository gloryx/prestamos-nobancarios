const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateHistoricalPortfolio } = require('../dist/modules/cierre-financiero/application/financial-period.service');
const { EstadoPrestamo } = require('../dist/modules/prestamos/domain/enums/estado-prestamo.enum');

const loan = (id, fechaAlta, capital, estado = EstadoPrestamo.ACTIVO) => ({ id, fechaAlta, capital, estado });
const payment = (prestamoId, fecha, capitalAplicado) => ({ prestamoId, fecha, capitalAplicado });
const refinancing = (prestamoOrigenId, prestamoNuevoId, fecha) => ({ prestamoOrigenId, prestamoNuevoId, fecha });
const portfolio = (loans, payments, refinanciamientos, fechaCorte) =>
  calculateHistoricalPortfolio(loans, payments, refinanciamientos, fechaCorte);

test('includes capital when cancellation happened after the cutoff', () => {
  assert.equal(portfolio([loan(1, '2026-01-01', 100, EstadoPrestamo.CANCELADO)], [], [], '2026-01-31'), 100);
});

test('uses only payments dated on or before the cutoff', () => {
  assert.equal(portfolio([loan(1, '2026-01-01', 100)], [payment(1, '2026-02-01', 40)], [], '2026-01-31'), 100);
  assert.equal(portfolio([loan(1, '2026-01-01', 100)], [payment(1, '2026-01-31', 40)], [], '2026-01-31'), 60);
});

test('keeps the origin before a later refinancing', () => {
  const loans = [loan(1, '2026-01-01', 100), loan(2, '2026-03-01', 120)];
  const refi = [refinancing(1, 2, '2026-03-01')];
  assert.equal(portfolio(loans, [], refi, '2026-02-28'), 100);
  assert.equal(portfolio(loans, [], refi, '2026-03-01'), 120);
});

test('excludes the origin and includes the new loan after refinancing', () => {
  assert.equal(portfolio([loan(1, '2026-01-01', 100), loan(2, '2026-02-15', 120)], [], [refinancing(1, 2, '2026-02-15')], '2026-02-15'), 120);
});

test('reconstructs A-B-C without duplication at three dates', () => {
  const loans = [loan(1, '2026-01-01', 100), loan(2, '2026-02-01', 120), loan(3, '2026-03-01', 140)];
  const refi = [refinancing(1, 2, '2026-02-01'), refinancing(2, 3, '2026-03-01')];
  assert.deepEqual([
    portfolio(loans, [], refi, '2026-01-31'),
    portfolio(loans, [], refi, '2026-02-28'),
    portfolio(loans, [], refi, '2026-03-31'),
  ], [100, 120, 140]);
});

test('excludes a loan created after the cutoff', () => {
  assert.equal(portfolio([loan(1, '2026-02-01', 100)], [], [], '2026-01-31'), 0);
});

test('floors fully paid capital at zero', () => {
  assert.equal(portfolio([loan(1, '2026-01-01', 100)], [payment(1, '2026-01-31', 130)], [], '2026-01-31'), 0);
});

test('does not mutate an existing closed snapshot when loan facts change', () => {
  const closedSnapshot = portfolio([loan(1, '2026-01-01', 100)], [], [], '2026-01-31');
  const editedFacts = [loan(1, '2026-01-01', 70)];
  assert.equal(portfolio(editedFacts, [], [], '2026-01-31'), 70);
  assert.equal(closedSnapshot, 100);
});

test('supports month-to-month continuity from the prior historical total', () => {
  const loans = [loan(1, '2026-01-01', 100)];
  const january = portfolio(loans, [], [], '2026-01-31');
  const february = portfolio(loans, [payment(1, '2026-02-15', 25)], [], '2026-02-28');
  assert.equal(january, 100);
  assert.equal(february, 75);
  assert.equal(january, 100, 'the prior month value remains immutable');
});
