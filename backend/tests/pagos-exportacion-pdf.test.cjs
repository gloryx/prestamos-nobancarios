const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { PagosPdfService } = require('../dist/modules/pagos/infrastructure/pdf/pagos-pdf.service');

const repositorySource = fs.readFileSync(path.join(__dirname, '../src/modules/pagos/infrastructure/persistence/typeorm/pago.typeorm-repository.ts'), 'utf8');
const controllerSource = fs.readFileSync(path.join(__dirname, '../src/modules/pagos/presentation/controllers/pagos.controller.ts'), 'utf8');
const dtoSource = fs.readFileSync(path.join(__dirname, '../src/modules/pagos/application/dto/filtros-pagos.dto.ts'), 'utf8');
const pdfSource = fs.readFileSync(path.join(__dirname, '../src/modules/pagos/infrastructure/pdf/pagos-pdf.service.ts'), 'utf8');

test('A: export rejects a reversed inclusive date range', () => assert.match(fs.readFileSync(path.join(__dirname, '../src/modules/pagos/application/use-cases/exportar-pagos-pdf.use-case.ts'), 'utf8'), /fechaDesde > dto\.fechaHasta/));
test('B: TODOS keeps table status while totals are registered-only', () => { assert.match(repositorySource, /status !== 'TODOS'/); assert.match(repositorySource, /registeredOnly/); assert.match(repositorySource, /estadoFiltro: registeredOnly \? 'REGISTRADO' : status/); });
test('C: annulled rows remain visible and are excluded from totals', () => { assert.match(repositorySource, /pago\.estado = :estadoFiltro/); assert.match(repositorySource, /estadoFiltro: registeredOnly \? 'REGISTRADO'/); assert.match(pdfSource, /Nota: los pagos ANULADO/); });
test('D: combined filters use the same shared applyFilters method', () => { assert.equal((repositorySource.match(/this\.applyFilters\(/g) || []).length, 4); assert.match(repositorySource, /filtros\.fechaDesde[\s\S]*filtros\.fechaHasta[\s\S]*filtros\.formaPagoId[\s\S]*filtros\.cobradorId[\s\S]*filtros\.prestamoId/); });
test('E: rows without PlanPago render as a dash and never require a fabricated installment', () => assert.match(fs.readFileSync(path.join(__dirname, '../src/modules/pagos/infrastructure/pdf/pagos-pdf.service.ts'), 'utf8'), /pago\.numeroPago == null \? '—'/));
test('F: export order is payment date DESC then id DESC', () => assert.match(repositorySource, /listarParaExportacion[\s\S]*orderBy\('pago\.fecha', 'DESC'\)\.addOrderBy\('pago\.id', 'DESC'\)/));
test('G: export has no silent listing limit or pagination', () => { const method = repositorySource.match(/async listarParaExportacion[\s\S]*?\n   }/)[0]; assert.match(method, /getMany\(\)/); assert.doesNotMatch(method, /skip\(|take\(/); });
test('H: export remains restricted to administrators', () => { assert.match(controllerSource, /@Controller\('pagos'\)/); assert.match(controllerSource, /@Get\('exportar\/pdf'\) @Roles\(RolUsuario\.ADMINISTRADOR\)/); });
test('I: PDF endpoint declares the PDF content type and attachment contract', () => { assert.match(controllerSource, /@Get\('exportar\/pdf'\)/); assert.match(controllerSource, /'Content-Type': 'application\/pdf'/); assert.match(controllerSource, /historial-pagos-\$\{desde\}-\$\{hasta\}\.pdf/); });
test('J: no-filter export defaults the table and totals to REGISTRADO', async () => {
  assert.match(dtoSource, /estado: EstadoPago \| 'TODOS' = EstadoPago\.REGISTRADO/);
  const service = new PagosPdfService();
  const pdf = await service.generar({ datos: [], totales: { cantidadPagos: 0, totalRecibido: 0, capitalAplicado: 0, interesAplicado: 0 } }, { estado: 'REGISTRADO' });
  assert.ok(pdf.subarray(0, 5).toString() === '%PDF-');
});

test('K: PDF uses the distributed Unicode font and four balanced summary blocks', () => {
  assert.match(pdfSource, /NotoSans-Regular\.ttf/);
  assert.match(pdfSource, /NotoSans-Bold\.ttf/);
  assert.match(pdfSource, /document\.registerFont\('Unicode'/);
  assert.match(pdfSource, /Pagos válidos/);
  assert.match(pdfSource, /const blockWidth = width \/ summary\.length/);
  assert.match(pdfSource, /REGISTRADO cuentan como pagos válidos/);
});
