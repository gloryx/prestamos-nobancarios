const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DesempenoCobradoresUseCase } = require('../dist/modules/reportes/application/desempeno-cobradores.use-case');
const { DesempenoCobradoresPdfService } = require('../dist/modules/reportes/infrastructure/desempeno-cobradores-pdf.service');
const pdfSource = fs.readFileSync(path.join(__dirname, '../src/modules/reportes/infrastructure/desempeno-cobradores-pdf.service.ts'), 'utf8');

const baseRows = [
  { cobradorId: 2, cobradorNombre: 'Beta', cantidadPagos: 1, montoRecibido: 300, capitalAplicado: 250, interesAplicado: 50, cantidadClientes: 1, cantidadPrestamos: 1 },
  { cobradorId: 1, cobradorNombre: 'Alpha', cantidadPagos: 2, montoRecibido: 200, capitalAplicado: 150, interesAplicado: 50, cantidadClientes: 2, cantidadPrestamos: 2 },
];

function repository(rows = baseRows, totals = { cantidadPagos: 3, totalRecibido: 500, capitalAplicado: 400, interesAplicado: 100, cantidadCobradores: 2 }) {
  const calls = [];
  return { calls, agrupar: async (filters) => { calls.push(['agrupar', filters]); return rows; }, totales: async (filters) => { calls.push(['totales', filters]); return totals; } };
}

const pdfReport = (rows) => ({ fechaDesde: '2026-09-01', fechaHasta: '2026-09-30', totales: { cantidadPagos: rows.length, totalRecibido: rows.length * 100, capitalAplicado: rows.length * 80, interesAplicado: rows.length * 20, cantidadCobradores: rows.length }, cobradores: rows.map((name, index) => ({ cobradorId: index + 1, cobradorNombre: name, cantidadPagos: 1, montoRecibido: 100, capitalAplicado: 80, interesAplicado: 20, cantidadClientes: 1, cantidadPrestamos: 1, promedioPorPago: 100, participacionMonto: 100 / rows.length })) });
const pageCount = (pdf) => (pdf.toString('latin1').match(/\/Type\s*\/Page\s*\/Parent\b/g) || []).length;
const renderPdf = (rows) => new DesempenoCobradoresPdfService().generar(pdfReport(rows), { fechaDesde: '2026-09-01', fechaHasta: '2026-09-30' });

test('PDF: resuelve nombres de filtros y usa fallback seguro si no existen', async () => {
  const service = { generar: async (_report, _query, labels) => labels };
  const useCase = new (require('../dist/modules/reportes/application/exportar-desempeno-cobradores-pdf.use-case').ExportarDesempenoCobradoresPdfUseCase)(
    { execute: async () => pdfReport(['Alpha']) }, service,
    { buscarPorId: async () => ({ nombreCompleto: 'Ana Pérez' }) },
    { buscarPorId: async () => null },
  );
  assert.deepEqual(await useCase.execute({ fechaDesde: '2026-09-01', fechaHasta: '2026-09-30', cobradorId: 7, formaPagoId: 3 }), { cobradorNombre: 'Ana Pérez', formaPagoNombre: 'Forma de pago ID 3' });
});

test('PDF: una página física conserva el footer 1 de 1 sin crear página extra', async () => {
  const pdf = await renderPdf(['José ₡']);
  assert.equal(pageCount(pdf), 1);
  assert.match(pdfSource, /bufferedPageRange\(\)[\s\S]*switchToPage/);
  assert.match(pdfSource, /FOOTER_Y[\s\S]*height: FOOTER_HEIGHT/);
});

test('PDF: dos páginas físicas tienen footer 1/2 y 2/2, sin tercera página', async () => {
  const pdf = await renderPdf(Array.from({ length: 20 }, (_, index) => `Cobrador ${index + 1}`));
  assert.equal(pageCount(pdf), 2);
  assert.match(pdfSource, /Página \$\{page - range\.start \+ 1\} de \$\{range\.count\}/);
  assert.doesNotMatch(pdfSource, /document\.addPage\(\)[\s\S]*footer/);
});

test('PDF: la exportación multipágina conserva filas y encabezados', async () => {
  const names = Array.from({ length: 35 }, (_, index) => `Cobrador ${index + 1}`);
  const pdf = await renderPdf(names);
  assert.equal(pageCount(pdf), 3);
  assert.equal((pdfSource.match(/drawTableHeader/g) || []).length, 4);
  assert.match(pdfSource, /report\.cobradores\.forEach\(\(row, index\) => drawRow\(values\(row\), index\)\)/);
});

test('PDF: TOTAL usa guion en promedio, conserva promedios individuales, identidad y Unicode', async () => {
  const pdf = await renderPdf(['José ₡']);
  assert.ok(pdf.length > 0);
  assert.match(pdfSource, /'—', report\.totales\.totalRecibido > 0 \? '100\.00%'/);
  assert.match(pdfSource, /money\(row\.promedioPorPago\)/);
  assert.match(pdfSource, /registerFont\('Unicode'/);
  assert.match(pdfSource, /cobradorNombre/);
});

test('A/I - expone identidad y métricas agregadas sin recalcular pagos', async () => {
  const repo = repository();
  const result = await new DesempenoCobradoresUseCase(repo).execute({ fechaDesde: '2026-09-01', fechaHasta: '2026-09-30' });
  assert.deepEqual(result.totales, { cantidadPagos: 3, totalRecibido: 500, capitalAplicado: 400, interesAplicado: 100, cantidadCobradores: 2 });
  assert.deepEqual(result.cobradores.map((row) => [row.cobradorId, row.cobradorNombre]), [[2, 'Beta'], [1, 'Alpha']]);
  assert.equal(result.cobradores[0].promedioPorPago, 300);
});

test('A - suma monto, capital e interés de la identidad del cobrador', async () => {
  const result = await new DesempenoCobradoresUseCase(repository([{ ...baseRows[0], cantidadPagos: 2, montoRecibido: 150.55, capitalAplicado: 100.25, interesAplicado: 50.30 }], { cantidadPagos: 2, totalRecibido: 150.55, capitalAplicado: 100.25, interesAplicado: 50.30, cantidadCobradores: 1 })).execute({ fechaDesde: '2026-09-01', fechaHasta: '2026-09-30' });
  assert.deepEqual(result.cobradores[0], { cobradorId: 2, cobradorNombre: 'Beta', cantidadPagos: 2, montoRecibido: 150.55, capitalAplicado: 100.25, interesAplicado: 50.3, cantidadClientes: 1, cantidadPrestamos: 1, promedioPorPago: 75.28, participacionMonto: 100 });
});

test('B/G - conserva filas de dos cobradores y calcula participación sobre el total', async () => {
  const result = await new DesempenoCobradoresUseCase(repository()).execute({ fechaDesde: '2026-09-01', fechaHasta: '2026-09-30' });
  assert.equal(result.cobradores[0].participacionMonto, 60);
  assert.equal(result.cobradores[1].participacionMonto, 40);
});

test('C - el repositorio recibe la consulta exclusiva de REGISTRADO por su contrato', async () => {
  const repo = repository();
  const result = await new DesempenoCobradoresUseCase(repo).execute({ fechaDesde: '2026-09-01', fechaHasta: '2026-09-30' });
  assert.equal(result.totales.totalRecibido, 500);
  assert.equal(repo.calls.length, 2);
});

test('C - un agregado con monto anulado fuera del conjunto no altera el total', async () => {
  const result = await new DesempenoCobradoresUseCase(repository([{ ...baseRows[0] }], { cantidadPagos: 1, totalRecibido: 300, capitalAplicado: 250, interesAplicado: 50, cantidadCobradores: 1 })).execute({ fechaDesde: '2026-09-01', fechaHasta: '2026-09-30' });
  assert.equal(result.totales.totalRecibido, 300);
});

test('D/E - conserva clientes y préstamos distinct entregados por SQL', async () => {
  const rows = [{ ...baseRows[0], cantidadPagos: 3, cantidadClientes: 2, cantidadPrestamos: 2 }];
  const result = await new DesempenoCobradoresUseCase(repository(rows, { cantidadPagos: 3, totalRecibido: 300, capitalAplicado: 250, interesAplicado: 50, cantidadCobradores: 1 })).execute({ fechaDesde: '2026-09-01', fechaHasta: '2026-09-30' });
  assert.equal(result.cobradores[0].cantidadClientes, 2);
  assert.equal(result.cobradores[0].cantidadPrestamos, 2);
});

test('D - mantiene la cantidad de clientes distinct', async () => {
  const result = await new DesempenoCobradoresUseCase(repository([{ ...baseRows[0], cantidadClientes: 3 }], { cantidadPagos: 1, totalRecibido: 300, capitalAplicado: 250, interesAplicado: 50, cantidadCobradores: 1 })).execute({ fechaDesde: '2026-09-01', fechaHasta: '2026-09-30' });
  assert.equal(result.cobradores[0].cantidadClientes, 3);
});

test('E - mantiene la cantidad de préstamos distinct', async () => {
  const result = await new DesempenoCobradoresUseCase(repository([{ ...baseRows[0], cantidadPrestamos: 4 }], { cantidadPagos: 1, totalRecibido: 300, capitalAplicado: 250, interesAplicado: 50, cantidadCobradores: 1 })).execute({ fechaDesde: '2026-09-01', fechaHasta: '2026-09-30' });
  assert.equal(result.cobradores[0].cantidadPrestamos, 4);
});

test('F/H - valida rango y propaga filtros opcionales', async () => {
  const repo = repository();
  await assert.rejects(() => new DesempenoCobradoresUseCase(repo).execute({ fechaDesde: '2026-09-30', fechaHasta: '2026-09-01' }), /fechaDesde/);
  await new DesempenoCobradoresUseCase(repo).execute({ fechaDesde: '2026-09-01', fechaHasta: '2026-09-30', cobradorId: 7, formaPagoId: 3 });
  assert.deepEqual(repo.calls[0][1], { fechaDesde: '2026-09-01', fechaHasta: '2026-09-30', cobradorId: 7, formaPagoId: 3 });
});

test('F - acepta los límites inclusivos sin desplazarlos', async () => {
  const repo = repository();
  await new DesempenoCobradoresUseCase(repo).execute({ fechaDesde: '2026-02-01', fechaHasta: '2026-02-28' });
  assert.equal(repo.calls[0][1].fechaDesde, '2026-02-01');
  assert.equal(repo.calls[0][1].fechaHasta, '2026-02-28');
});

test('G - una sola fila representa el 100 por ciento del conjunto', async () => {
  const result = await new DesempenoCobradoresUseCase(repository([baseRows[0]], { cantidadPagos: 1, totalRecibido: 300, capitalAplicado: 250, interesAplicado: 50, cantidadCobradores: 1 })).execute({ fechaDesde: '2026-09-01', fechaHasta: '2026-09-30' });
  assert.equal(result.cobradores[0].participacionMonto, 100);
});

test('H - el filtro de forma de pago se conserva en ambas consultas', async () => {
  const repo = repository();
  await new DesempenoCobradoresUseCase(repo).execute({ fechaDesde: '2026-09-01', fechaHasta: '2026-09-30', formaPagoId: 4 });
  assert.equal(repo.calls[0][1].formaPagoId, 4);
  assert.equal(repo.calls[1][1].formaPagoId, 4);
});

test('I - orden de identidad se preserva desde las filas agregadas', async () => {
  const result = await new DesempenoCobradoresUseCase(repository([baseRows[1], baseRows[0]])).execute({ fechaDesde: '2026-09-01', fechaHasta: '2026-09-30' });
  assert.deepEqual(result.cobradores.map((row) => row.cobradorId), [1, 2]);
});

test('J - sin datos devuelve ceros finitos y no NaN/Infinity', async () => {
  const result = await new DesempenoCobradoresUseCase(repository([], { cantidadPagos: 0, totalRecibido: 0, capitalAplicado: 0, interesAplicado: 0, cantidadCobradores: 0 })).execute({ fechaDesde: '2026-09-01', fechaHasta: '2026-09-30' });
  assert.deepEqual(result.cobradores, []);
  assert.equal(result.totales.totalRecibido, 0);
  assert.ok(Object.values(result.totales).every(Number.isFinite));
});

test('K - soporta defensivamente una fila sin cobrador sin debilitar la entidad', async () => {
  const row = { ...baseRows[0], cobradorId: null, cobradorNombre: null };
  const result = await new DesempenoCobradoresUseCase(repository([row], { cantidadPagos: 1, totalRecibido: 300, capitalAplicado: 250, interesAplicado: 50, cantidadCobradores: 0 })).execute({ fechaDesde: '2026-09-01', fechaHasta: '2026-09-30' });
  assert.deepEqual(result.cobradores[0], { cobradorId: null, cobradorNombre: 'Sin cobrador', cantidadPagos: 1, montoRecibido: 300, capitalAplicado: 250, interesAplicado: 50, cantidadClientes: 1, cantidadPrestamos: 1, promedioPorPago: 300, participacionMonto: 100 });
});
