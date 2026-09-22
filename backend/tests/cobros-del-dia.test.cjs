const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { BadRequestException } = require('@nestjs/common');
const { ConsultarCobrosDelDiaUseCase } = require('../dist/modules/pagos/application/use-cases/consultar-cobros-del-dia.use-case');

const source = fs.readFileSync(path.join(__dirname, '../src/modules/pagos/infrastructure/persistence/typeorm/cobros-del-dia.typeorm-repository.ts'), 'utf8');
const controllerSource = fs.readFileSync(path.join(__dirname, '../src/modules/pagos/presentation/controllers/pagos.controller.ts'), 'utf8');
const obligation = (overrides = {}) => ({ planPagoId: 1, numeroPago: 3, fecha: '2026-09-15', montoProgramado: 100, saldoPendiente: 40, prestamoId: 10, capital: 100, saldoActual: 100, estadoPrestamo: 'ACTIVO', periodicidad: 'SEMANAL', clienteId: 20, nombreCompleto: 'Fictional Client', identificacion: 'FICTIONAL-1', telefonoPrincipal: '0000-0000', direccion: null, formaPagoId: 1, formaPagoNombre: 'Efectivo', cobradorId: null, cobradorNombre: null, ...overrides });
const payment = (overrides = {}) => ({ pagoId: 7, fecha: '2026-09-15', monto: 60, planPagoId: 1, numeroPago: 3, fechaVencimiento: '2026-09-15', prestamoId: 10, estadoPrestamo: 'CANCELADO', clienteId: 20, nombreCompleto: 'Fictional Client', identificacion: 'FICTIONAL-1', telefonoPrincipal: '0000-0000', direccion: null, formaPagoId: 1, formaPagoNombre: 'Efectivo', cobradorId: 4, cobradorNombre: 'Fictional Collector', ...overrides });
const useCase = (result = { porCobrar: [], pagaron: [] }) => new ConsultarCobrosDelDiaUseCase({ consultar: async (query) => { useCase.query = query; return result; } });
const rejects = async (query) => assert.rejects(() => useCase().execute(query), BadRequestException);

test('1. accepts a single date and preserves the request sequence', async () => {
  const result = await useCase().execute({ fecha: '2026-09-15' });
  assert.equal(result.fecha, '2026-09-15');
  assert.deepEqual(useCase.query, { fecha: '2026-09-15' });
});

test('2. includes only the current operational remainder for a due obligation', () => {
  assert.match(source, /GREATEST\(plan\.monto_programado - COALESCE\(pago_plan\.monto_pagado, 0\), 0\)/);
  assert.match(source, /GREATEST\(plan\.monto_programado - COALESCE\(pago_plan\.monto_pagado, 0\), 0\) > 0/);
});

test('3. excludes fully paid obligations, including payments made on the selected date', () => {
  assert.match(source, /WHERE pago\.estado = 'REGISTRADO'/);
  assert.match(source, /\.andWhere\('GREATEST\(plan\.monto_programado - COALESCE\(pago_plan\.monto_pagado, 0\), 0\) > 0'\)/);
});

test('4. does not reconstruct prior-date overdue obligations', () => {
  assert.match(source, /plan\.fecha_vencimiento = :date/);
  assert.match(source, /plan\.fecha_vencimiento BETWEEN :from AND :to/);
  assert.doesNotMatch(source, /pago_previo|registeredBeforePeriod/);
});

test('5. returns partial operational remainder from the adjusted plan', async () => {
  const result = await useCase({ porCobrar: [obligation({ montoProgramado: 150, saldoPendiente: 50 })], pagaron: [] }).execute({ fecha: '2026-09-15' });
  assert.equal(result.porCobrar[0].saldoPendiente, 50);
  assert.equal(result.totales.porCobrar.monto, 50);
});

test('6. returns one payment row per registered payment and preserves identity/date/amount', async () => {
  const result = await useCase({ porCobrar: [], pagaron: [payment({ pagoId: 8, monto: 25 }), payment({ pagoId: 9, monto: 35 })] }).execute({ fecha: '2026-09-15' });
  assert.deepEqual(result.pagaron.map(row => [row.pagoId, row.fecha, row.monto]), [[8, '2026-09-15', 25], [9, '2026-09-15', 35]]);
  assert.equal(result.totales.pagaron.monto, 60);
  assert.match(source, /pago\.estado = 'REGISTRADO'/);
  assert.match(source, /pago\.fecha = :date/);
});

test('7. excludes ANULADO payments and does not filter payments by loan state or due date', () => {
  assert.match(source, /where\("pago\.estado = 'REGISTRADO'"\)/);
  assert.match(source, /leftJoin\('plan_pago', 'plan'/);
  assert.match(source, /prestamo\.estado', 'estadoPrestamo'/);
});

test('8. separates obligations and payments, so a fully paid same-day plan is not duplicated', async () => {
  const result = await useCase({ porCobrar: [], pagaron: [payment()] }).execute({ fecha: '2026-09-15' });
  assert.equal(result.porCobrar.length, 0);
  assert.equal(result.pagaron.length, 1);
  assert.deepEqual(result.totales, { porCobrar: { cantidad: 0, monto: 0 }, pagaron: { cantidad: 1, monto: 60 } });
});

test('9. range dates remain inclusive and totals contain no duplicate rows', async () => {
  const result = await useCase({ porCobrar: [obligation({ planPagoId: 2 })], pagaron: [payment({ pagoId: 10, fecha: '2026-09-15' }), payment({ pagoId: 11, fecha: '2026-09-17' })] }).execute({ fechaDesde: '2026-09-15', fechaHasta: '2026-09-17' });
  assert.equal(result.porCobrar.length, 1);
  assert.equal(result.pagaron.length, 2);
  assert.deepEqual(result.totales, { porCobrar: { cantidad: 1, monto: 40 }, pagaron: { cantidad: 2, monto: 120 } });
  assert.deepEqual(useCase.query, { fechaDesde: '2026-09-15', fechaHasta: '2026-09-17' });
});

test('10. keeps endpoint roles unchanged', () => {
  assert.match(controllerSource, /@Roles\(RolUsuario\.ADMINISTRADOR, RolUsuario\.VENDEDOR, RolUsuario\.COBRADOR\).*Consultar cobros del día/);
});

test('rejects invalid date filters', async () => {
  await rejects({});
  await rejects({ fecha: '2026-02-30' });
  await rejects({ fechaDesde: '2026-09-30', fechaHasta: '2026-09-15' });
});
