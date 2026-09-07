const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const fs = require('node:fs');
const path = require('node:path');
const { PrestamosExcelGenerator } = require('../dist/modules/prestamos/infrastructure/reports/prestamos-excel.generator');

const loan = (id, recovered) => ({
  id, fechaAlta: new Date(Date.UTC(2026, 0, id)), capital: 100, interes: 20, montoTotal: 120, recuperado: recovered,
  estado: 'ACTIVO', cantidadPagos: 2, cliente: { nombre: `Client ${id}`, identificacion: `ID-${id}`, direccion: 'San José' },
});

test('Excel export creates a valid workbook with dates, currency, filters, totals, and no pagination', async () => {
  const generator = new PrestamosExcelGenerator();
  const result = await generator.generate([loan(1, 30), loan(2, 0)], new Map([
    [1, { indicadorCobranza: 'ATRASADO', fechaLimiteContractual: '2026-03-01' }],
    [2, { indicadorCobranza: 'AL_DIA', fechaLimiteContractual: '2026-03-02' }],
  ]), { total: 2, prestado: 200, ganancia: 40, recuperado: 30, pendiente: 210 }, {
    pagina: 99, limite: 1, estados: ['ACTIVO'], buscar: 'Client', direccion: 'San', fechaInicio: '2026-01-01', fechaFin: '2026-12-31',
  });
  assert.equal(result.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.equal(result.filename, 'Prestamos_01-01-2026_al_31-12-2026.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(result.buffer);
  const sheet = workbook.getWorksheet('Préstamos');
  assert.equal(sheet.getRow(4).getCell(1).value, 'N° Préstamo');
  assert.equal(sheet.getRow(5).getCell(9).value, 30);
  assert.equal(sheet.getRow(5).getCell(9).numFmt, '[$₡-es-CR] #,##0.00');
  assert.equal(sheet.getRow(5).getCell(5).numFmt, 'dd/mm/yyyy');
  assert.equal(sheet.getCell('A8').value, 'RESUMEN');
  assert.equal(sheet.autoFilter, undefined); // the table owns the autofilter
  assert.ok(sheet.getTable('PrestamosExportados'));
});

test('Excel export route is protected for administrator and seller roles', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/modules/prestamos/presentation/controllers/prestamos.controller.ts'), 'utf8');
  assert.match(source, /@Get\('export\/excel'\)[\s\S]*?@Roles\(RolUsuario\.ADMINISTRADOR, RolUsuario\.VENDEDOR\)/);
});

test('empty Excel export remains a valid zero-row workbook', async () => {
  const result = await new PrestamosExcelGenerator().generate([], new Map(), { total: 0, prestado: 0, ganancia: 0, recuperado: 0, pendiente: 0 }, { pagina: 1, limite: 10, estados: ['ACTIVO'] });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(result.buffer);
  assert.equal(workbook.getWorksheet('Préstamos').getCell('B7').value, 0);
});
