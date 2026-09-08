const test = require('node:test');
const assert = require('node:assert/strict');
const { ObtenerAnalisisFinancieroUseCase } = require('../dist/modules/clientes/application/use-cases/obtener-analisis-financiero.use-case');
const state = { ACTIVO: 'ACTIVO', CANCELADO: 'CANCELADO', REFINANCIADO: 'REFINANCIADO', INCOBRABLE: 'INCOBRABLE' };
const client = { id: 7, identificacion: '7-000', primerNombre: 'ANA', segundoNombre: null, primerApellido: 'PEREZ', segundoApellido: null, telefono1: '111', telefono2: null };
const loan = (id, estado, capital, interes, date = '2026-01-01') => ({ id, estado, fechaAlta: new Date(`${date}T00:00:00Z`), capital, interes, montoTotal: capital + interes, cantidadPagos: 1, periodicidad: 'MENSUAL' });

test('returns a bulk financial analysis with real payment formulas and terminal durations', async () => {
  const loans = [loan(1, state.ACTIVO, 100, 20), loan(2, state.CANCELADO, 100, 20), loan(3, state.REFINANCIADO, 100, 20), loan(4, state.INCOBRABLE, 10.1, 0.2)];
  const ordered = [
    { id: 10, prestamoId: 1, monto: 0.1, capitalAplicado: 0.1, interesAplicado: 0, fecha: '2026-01-02' },
    { id: 11, prestamoId: 1, monto: 0.2, capitalAplicado: 0.2, interesAplicado: 0, fecha: '2026-01-03' },
    { id: 20, prestamoId: 2, monto: 100, capitalAplicado: 100, interesAplicado: 0, fecha: '2026-01-02' },
    { id: 21, prestamoId: 2, monto: 20, capitalAplicado: 0, interesAplicado: 20, fecha: '2026-01-03' },
  ];
  const calls = { loans: 0, totals: 0, latest: 0, ordered: 0, refinancing: 0, overdue: 0 };
  const repo = {
    listarPrestamos: async () => { calls.loans++; return loans; },
    obtenerTotalesPagos: async () => { calls.totals++; return [{ prestamoId: 1, monto: 0.3, capital: 0.3, interes: 0 }, { prestamoId: 2, monto: 120, capital: 100, interes: 20 }]; },
    listarUltimosPagos: async () => { calls.latest++; return [ordered[1], ordered[3]]; },
    listarPagosOrdenados: async () => { calls.ordered++; return ordered; },
    listarRefinanciamientos: async () => { calls.refinancing++; return [{ prestamoOrigenId: 3, fecha: '2026-03-01' }]; },
    listarObligacionesVencidas: async () => { calls.overdue++; return []; },
  };
  const result = await new ObtenerAnalisisFinancieroUseCase({ buscarPorId: async () => client }, repo).execute(7);
  assert.deepEqual(calls, { loans: 1, totals: 1, latest: 1, ordered: 1, refinancing: 1, overdue: 1 });
  assert.equal(result.prestamos.length, 4);
  assert.equal(result.prestamos[0].totalPagado, 0.3);
  assert.equal(result.prestamos[0].capitalPendiente, 99.7);
  assert.equal(result.prestamos[0].interesPendiente, 20);
  assert.equal(result.prestamos[0].ultimoPago.fecha, '2026-01-03');
  assert.equal(result.prestamos[1].tipoDuracion, 'FINALIZADO');
  assert.equal(result.prestamos[1].duracionDias, 2);
  assert.equal(result.prestamos[2].tipoDuracion, 'FINALIZADO');
  assert.equal(result.prestamos[2].duracionDias, 59);
  assert.equal(result.prestamos[3].tipoDuracion, 'TRANSCURRIDOS');
  assert.equal(result.resumen.cantidadPrestamos, 4);
});

test('handles missing clients, no loans and no payments without extra queries', async () => {
  let paymentCalls = 0;
  const emptyRepo = { listarPrestamos: async () => [], obtenerTotalesPagos: async () => { paymentCalls++; }, listarUltimosPagos: async () => { paymentCalls++; }, listarPagosOrdenados: async () => { paymentCalls++; }, listarRefinanciamientos: async () => { paymentCalls++; }, listarObligacionesVencidas: async () => { paymentCalls++; } };
  const empty = await new ObtenerAnalisisFinancieroUseCase({ buscarPorId: async () => client }, emptyRepo).execute(7);
  assert.deepEqual(empty.resumen, { totalPrestado: 0, totalPagado: 0, pendiente: 0, ganancia: 0, cantidadPrestamos: 0 });
  assert.equal(paymentCalls, 0);
  await assert.rejects(() => new ObtenerAnalisisFinancieroUseCase({ buscarPorId: async () => null }, emptyRepo).execute(404), /Cliente no encontrado/);
});
