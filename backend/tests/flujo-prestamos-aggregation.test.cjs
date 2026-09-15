const test = require('node:test');
const assert = require('node:assert/strict');
const { aggregateFlujoPrestamos, totalFlujoPrestamos } = require('../dist/modules/reportes/application/flujo-prestamos-aggregation');

test('builds all months, preserves reversal date, and calculates composition', () => {
  const rows = aggregateFlujoPrestamos('2024-12', '2025-01', [
    { periodo: '2024-12', monto: '150.00', capitalAplicado: '100.00', interesAplicado: '50.00' },
    { periodo: '2025-01', monto: 25, capitalAplicado: 25, interesAplicado: 0 },
  ], [
    { periodo: '2024-12', monto: 1000 },
    { periodo: '2024-12', monto: -1000 },
    { periodo: '2025-01', monto: 500 },
  ]);
  assert.deepEqual(rows.map((row) => row.periodo), ['2024-12', '2025-01']);
  assert.equal(rows[0].capitalColocado, 0, 'same-period reversal offsets only its own economic period');
  assert.equal(rows[1].capitalColocado, 500);
  assert.equal(rows[0].estadoDatos, 'OK');
  assert.equal(rows[1].estadoDatos, 'OK');
  assert.equal(rows[0].capitalRecuperado, 100);
  assert.equal(rows[0].gananciaRealizada, 50);
  assert.equal(rows[0].flujoNeto, 150);
  assert.equal(rows[0].diferenciaConciliacion, 0);
  assert.equal('flujoNetoEfectivo' in rows[0], false);
  assert.equal('conciliacion' in rows[0], false);
});

test('reports warning, zero-months, annual totals and null ratios when there are no payments', () => {
  const rows = aggregateFlujoPrestamos('2023-01', '2024-12', [], [{ periodo: '2024-01', monto: 10 }]);
  assert.equal(rows.length, 24);
  assert.equal(rows[0].capitalColocado, 0);
  assert.equal(rows.at(-1).mes, 12);
  assert.equal(rows.find((row) => row.periodo === '2024-01').estadoDatos, 'OK');
  const total = totalFlujoPrestamos(rows);
  assert.equal(total.capitalColocado, 10);
  assert.equal(total.porcentajeCapitalPagos, null);
  assert.equal(total.porcentajeInteresPagos, null);
});

test('marks payment identity differences as warning and includes every loan state by source rows', () => {
  const rows = aggregateFlujoPrestamos('2025-01', '2025-01', [{ periodo: '2025-01', monto: 100, capitalAplicado: 90, interesAplicado: 5 }], []);
  assert.equal(rows[0].diferenciaConciliacion, 5);
  assert.equal(rows[0].estadoDatos, 'ADVERTENCIA');
});

test('keeps the selected month structure when there are no real movements', () => {
  const rows = aggregateFlujoPrestamos('2026-01', '2026-03', [], []);
  assert.equal(rows.length, 3);
  assert.equal(rows.every((row) => row.pagosRecibidos === 0 && row.capitalColocado === 0), true);
  assert.equal(totalFlujoPrestamos(rows).flujoNeto, 0);
});
