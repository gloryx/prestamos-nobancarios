const test = require('node:test');
const assert = require('node:assert/strict');
const { ObtenerAnalisisFinancieroUseCase } = require('../dist/modules/clientes/application/use-cases/obtener-analisis-financiero.use-case');

const state = { ACTIVO: 'ACTIVO', CANCELADO: 'CANCELADO', REFINANCIADO: 'REFINANCIADO', INCOBRABLE: 'INCOBRABLE' };
const client = { id: 7, identificacion: '7-000', primerNombre: 'ANA', segundoNombre: null, primerApellido: 'PEREZ', segundoApellido: null, telefono1: '111', telefono2: null };
const loan = (id, estado, capital, interes, date = '2026-01-01', disbursed = capital) => ({ id, estado, fechaAlta: new Date(`${date}T00:00:00Z`), capital, interes, montoTotal: capital + interes, montoDesembolsado: disbursed, cantidadPagos: 1, periodicidad: 'MENSUAL' });
const payment = (id, prestamoId, monto, interest, fecha = '2026-02-01', estado = 'REGISTRADO') => ({ id, prestamoId, monto, capitalAplicado: monto - interest, interesAplicado: interest, fecha, estado });

function repository(loans, totals = [], payments = [], relations = [], calls = {}) {
  const count = (key, value = loans) => { calls[key] = (calls[key] ?? 0) + 1; return value; };
  return {
    listarPrestamos: async () => count('loans'),
    obtenerTotalesPagos: async () => count('totals', totals),
    listarUltimosPagos: async () => count('latest', loans.flatMap((loan) => payments.filter((p) => p.prestamoId === loan.id && p.estado === 'REGISTRADO').sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id).slice(0, 1))),
    listarPagosOrdenados: async () => count('ordered', payments.filter((p) => p.estado === 'REGISTRADO')),
    listarRefinanciamientos: async () => count('refinancing', relations),
    listarObligacionesVencidas: async () => count('overdue', []),
  };
}

async function execute(loans, totals, payments, relations, calls) {
  return new ObtenerAnalisisFinancieroUseCase({ buscarPorId: async () => client }, repository(loans, totals, payments, relations, calls)).execute(7);
}

test('calculates contractual, delivered, received, interest, chains and current pending with cents precision', async () => {
  const loans = [
    loan(40, state.REFINANCIADO, 200000, 10000, '2026-01-01', 200000),
    loan(41, state.REFINANCIADO, 160000, 10000, '2026-01-10', 50000),
    loan(43, state.REFINANCIADO, 120000, 10000, '2026-01-20', 30000),
    loan(44, state.ACTIVO, 100000, 60000, '2026-01-30', 40000),
    loan(50, state.ACTIVO, 10.1, 0.2, '2026-01-01', 10.1),
    loan(51, state.CANCELADO, 100, 20, '2026-01-01', 100),
    loan(52, state.INCOBRABLE, 25, 5, '2026-01-01', 25),
  ];
  const payments = [payment(1, 40, 0.1, 0), payment(2, 40, 0.2, 0), payment(3, 50, 0.3, 0.2, '2026-02-02'), payment(4, 51, 120, 20)];
  const totals = [
    { prestamoId: 40, monto: 0.3, capital: 0.3, interes: 0 },
    { prestamoId: 50, monto: 0.3, capital: 0.1, interes: 0.2 },
    { prestamoId: 51, monto: 120, capital: 100, interes: 20 },
  ];
  const relations = [
    { id: 1, prestamoOrigenId: 40, prestamoNuevoId: 41, fecha: '2026-02-01', capitalPendiente: 150000 },
    { id: 2, prestamoOrigenId: 41, prestamoNuevoId: 43, fecha: '2026-02-15', capitalPendiente: 120000 },
    { id: 3, prestamoOrigenId: 43, prestamoNuevoId: 44, fecha: '2026-02-25', capitalPendiente: 90000 },
  ];
  const calls = {};
  const result = await execute(loans, totals, payments, relations, calls);
  assert.deepEqual(calls, { loans: 1, totals: 1, latest: 1, ordered: 1, refinancing: 1, overdue: 1 });
  assert.equal(result.resumen.montoContractualAcumulado, 580135.1);
  assert.equal(result.resumen.montoRealmenteEntregado, 320135.1);
  assert.equal(result.resumen.montoRealmenteRecibido, 120.6);
  assert.equal(result.resumen.interesEfectivamenteCobrado, 20.2);
  assert.equal(result.resumen.pendienteVigente, 160010);
  assert.equal(result.resumen.saldoIncobrable, 30);
  assert.equal(result.resumen.cantidadCadenas, 1);
  assert.equal(result.resumen.cantidadPrestamosIndependientes, 3);
  assert.equal(result.prestamos.find((p) => p.id === 40).capitalTrasladadoHistorico, 150000);
  assert.equal(result.prestamos.find((p) => p.id === 40).tipoSaldo, 'TRASLADADO');
  assert.equal(result.prestamos.find((p) => p.id === 40).indicadorCobranza, 'REFINANCIADO');
  assert.equal(result.prestamos.find((p) => p.id === 44).saldoPendiente, 160000);
  assert.equal(result.prestamos.find((p) => p.id === 44).tipoSaldo, 'VIGENTE');
  assert.equal(result.resumen.totalPrestado, result.resumen.montoContractualAcumulado);
  assert.equal(result.resumen.pendiente, result.resumen.pendienteVigente);
  assert.equal(result.resumen.gananciaCobrada, 20.2);
});

test('does not count historical chain balances as current debt', async () => {
  const loans = [
    loan(40, state.REFINANCIADO, 200000, 10000, '2026-01-01', 200000),
    loan(41, state.REFINANCIADO, 160000, 10000, '2026-01-10', 50000),
    loan(43, state.REFINANCIADO, 120000, 10000, '2026-01-20', 30000),
    loan(44, state.ACTIVO, 100000, 60000, '2026-01-30', 40000),
  ];
  const relations = [
    { id: 1, prestamoOrigenId: 40, prestamoNuevoId: 41, fecha: '2026-02-01', capitalPendiente: 150000 },
    { id: 2, prestamoOrigenId: 41, prestamoNuevoId: 43, fecha: '2026-02-15', capitalPendiente: 120000 },
    { id: 3, prestamoOrigenId: 43, prestamoNuevoId: 44, fecha: '2026-02-25', capitalPendiente: 90000 },
  ];
  const result = await execute(loans, [], [], relations);
  assert.equal(result.resumen.montoContractualAcumulado, 580000);
  assert.equal(result.resumen.pendienteVigente, 160000);
  assert.equal(result.resumen.cantidadCadenas, 1);
});

test('keeps registered payment semantics, latest payment ordering and safe refinanced duration', async () => {
  const loans = [loan(1, state.REFINANCIADO, 100, 20), loan(2, state.ACTIVO, 100, 20), loan(3, state.CANCELADO, 100, 20)];
  const payments = [payment(10, 1, 0.1, 0, '2026-01-03'), payment(11, 1, 0.2, 0, '2026-01-03'), payment(12, 3, 120, 20)];
  const totals = [{ prestamoId: 1, monto: 0.3, capital: 0.3, interes: 0 }, { prestamoId: 3, monto: 120, capital: 100, interes: 20 }];
  const result = await execute(loans, totals, payments, [{ id: 1, prestamoOrigenId: 1, prestamoNuevoId: 2, fecha: '2026-03-01', capitalPendiente: 99.7 }]);
  assert.equal(result.prestamos.find((p) => p.id === 1).ultimoPago.fecha, '2026-01-03');
  assert.equal(result.prestamos.find((p) => p.id === 1).ultimoPago.monto, 0.2);
   assert.equal(result.prestamos.find((p) => p.id === 1).duracionDias, 2);
  assert.equal(result.prestamos.find((p) => p.id === 1).tipoDuracion, 'FINALIZADO');
   assert.equal(result.prestamos.find((p) => p.id === 2).tipoDuracion, 'INDISPONIBLE');
  assert.equal(result.resumen.pendienteVigente, 120);
});

test('returns zeros without payment or relation queries when the client has no loans', async () => {
  const calls = {};
  const result = await execute([], [], [], [], calls);
  assert.deepEqual(result.resumen, { montoContractualAcumulado: 0, montoRealmenteEntregado: 0, montoRealmenteRecibido: 0, pendienteVigente: 0, interesEfectivamenteCobrado: 0, cantidadPrestamos: 0, cantidadCadenas: 0, cantidadPrestamosIndependientes: 0, saldoIncobrable: 0, totalPrestado: 0, totalPagado: 0, pendiente: 0, gananciaCobrada: 0, ganancia: 0 });
  assert.deepEqual(calls, { loans: 1 });
});

test('rejects structurally inconsistent refinancing instead of inventing a successor', async () => {
  await assert.rejects(() => execute([loan(40, state.REFINANCIADO, 10, 1)], [], [], [], {}), /sin sucesor/);
});

test('calculates calendar-day duration from loan date to latest registered payment', async () => {
  const loans = [
    loan(101, state.ACTIVO, 10, 1, '2026-01-01'),
    loan(102, state.ACTIVO, 10, 1, '2026-01-01'),
    loan(103, state.ACTIVO, 10, 1, '2026-01-01'),
    loan(104, state.ACTIVO, 10, 1, '2026-02-01'),
    loan(105, state.ACTIVO, 10, 1, '2024-02-01'),
    loan(106, state.ACTIVO, 10, 1, '2024-12-31'),
    loan(107, state.ACTIVO, 10, 1, '2026-01-01'),
    loan(108, state.ACTIVO, 10, 1, '2026-01-01'),
  ];
  const payments = [
    payment(1, 101, 1, 0, '2026-01-01'),
    payment(2, 102, 1, 0, '2026-01-02'),
    payment(3, 103, 1, 0, '2026-02-01'),
    payment(4, 104, 1, 0, '2026-03-01'),
    payment(5, 105, 1, 0, '2024-03-01'),
    payment(6, 106, 1, 0, '2025-01-01'),
    payment(7, 107, 1, 0, '2026-01-02'),
    payment(999, 107, 1, 0, '2025-12-31'),
    payment(8, 108, 1, 0, '2026-02-01'),
    payment(9, 108, 1, 0, '2026-03-01', 'ANULADO'),
  ];
  const result = await execute(loans, [], payments, []);
  const duration = (id) => result.prestamos.find((p) => p.id === id).duracionDias;
  assert.equal(duration(101), 0);
  assert.equal(duration(102), 1);
  assert.equal(duration(103), 31);
  assert.equal(duration(104), 28);
  assert.equal(duration(105), 29);
  assert.equal(duration(106), 1);
  assert.equal(duration(107), 1);
  assert.equal(duration(108), 31);
  assert.equal(result.prestamos.find((p) => p.id === 108).ultimoPago.fecha, '2026-02-01');
});

test('returns unavailable duration without payments and uses latest payment for every loan status', async () => {
  const loans = [
    loan(201, state.ACTIVO, 10, 1, '2026-01-01'),
    loan(202, state.CANCELADO, 10, 1, '2026-01-01'),
    loan(203, state.REFINANCIADO, 10, 1, '2026-01-01'),
    loan(204, state.ACTIVO, 10, 1, '2026-01-01'),
  ];
  const payments = [
    payment(20, 201, 1, 0, '2026-02-01'),
    payment(21, 202, 1, 0, '2026-02-02'),
    payment(22, 203, 1, 0, '2026-02-03'),
  ];
  const relations = [{ id: 20, prestamoOrigenId: 203, prestamoNuevoId: 204, fecha: '2026-12-31', capitalPendiente: 9 }];
  const result = await execute(loans, [], payments, relations);
  assert.equal(result.prestamos.find((p) => p.id === 201).duracionDias, 31);
  assert.equal(result.prestamos.find((p) => p.id === 202).duracionDias, 32);
  assert.equal(result.prestamos.find((p) => p.id === 203).duracionDias, 33);
  assert.equal(result.prestamos.find((p) => p.id === 204).duracionDias, null);
  assert.equal(result.prestamos.find((p) => p.id === 204).tipoDuracion, 'INDISPONIBLE');
});
