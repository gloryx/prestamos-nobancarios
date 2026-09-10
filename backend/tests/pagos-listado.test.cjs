const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { PagosController } = require('../dist/modules/pagos/presentation/controllers/pagos.controller');
const { EstadoPago } = require('../dist/modules/pagos/domain/enums/estado-pago.enum');

const repositorySource = fs.readFileSync(path.join(__dirname, '../src/modules/pagos/infrastructure/persistence/typeorm/pago.typeorm-repository.ts'), 'utf8');

test('loan payment listing returns registered and annulled payments in date/id descending order', () => {
  assert.match(repositorySource, /pago\.estado IN \(:\.\.\.estados\)/);
  assert.match(repositorySource, /estados: \['REGISTRADO', 'ANULADO'\]/);
  assert.match(repositorySource, /orderBy\('pago\.fecha', 'DESC'\)\.addOrderBy\('pago\.id', 'DESC'\)/);
});

test('canAnular is false unless the registered payment is the latest safe payment', () => {
  assert.match(repositorySource, /pago\.estado = 'REGISTRADO' AND pago\.redistribuyo_plan = false/);
  assert.match(repositorySource, /pago_posterior\.estado = 'REGISTRADO'/);
  assert.match(repositorySource, /ref\.prestamo_origen_id = pago\.prestamo_id/);
  assert.match(repositorySource, /THEN true ELSE false END/);
  assert.match(repositorySource, /raw\[index\]\?\.pago_puede_anular/);
});

test('payment totals exclude annulled rows from the financial aggregate', () => {
  assert.match(repositorySource, /obtenerTotalesPorPrestamo[\s\S]*?pago\.estado = :estado/);
  assert.match(repositorySource, /obtenerTotalesPorPrestamo[\s\S]*?estado: 'REGISTRADO'/);
});

test('GET response exposes payment status, payment method name, cancellation audit and canAnular without redistribution flag', async () => {
  const controller = new PagosController({}, {}, {}, { execute: async () => [{
    id: 3, prestamoId: 1, formaPagoId: 2, monto: 100, capitalAplicado: 80, interesAplicado: 20, cobradorId: 7,
    fecha: new Date('2026-08-30T00:00:00.000Z'), fechaCreacion: new Date('2026-08-30T12:00:00.000Z'), observaciones: null,
    planPagoId: 3, numeroCuota: 3, estado: EstadoPago.ANULADO, formaPago: { id: 2, nombre: 'EFECTIVO' },
    prestamo: {}, cliente: {}, cobrador: {}, puedeAnular: false,
    anulacion: { fecha: new Date('2026-08-31T00:00:00.000Z'), motivo: 'OTRO', observacion: 'Correction' },
  }] }, {}, {}, {});
  const [payment] = await controller.listarPorPrestamo(1);
  assert.deepEqual({ id: payment.id, estado: payment.estado, formaPagoId: payment.formaPagoId, formaPagoNombre: payment.formaPagoNombre, puedeAnular: payment.puedeAnular, anulacion: payment.anulacion }, {
    id: 3, estado: EstadoPago.ANULADO, formaPagoId: 2, formaPagoNombre: 'EFECTIVO', puedeAnular: false,
    anulacion: { fecha: new Date('2026-08-31T00:00:00.000Z'), motivo: 'OTRO', observacion: 'Correction' },
  });
  assert.equal('redistribuyoPlan' in payment, false);
});

test('GET response keeps three annulled payments visible and marks each as not cancellable', async () => {
  const controller = new PagosController({}, {}, {}, { execute: async () => [1, 2, 3].map(id => ({
    id, prestamoId: 1, formaPagoId: 1, monto: 20000, capitalAplicado: 20000, interesAplicado: 0, cobradorId: 7,
    fecha: new Date(`2026-0${id}-01`), fechaCreacion: new Date(`2026-0${id}-01`), observaciones: null,
    planPagoId: id, numeroCuota: id, estado: EstadoPago.ANULADO, formaPago: { id: 1, nombre: 'EFECTIVO' },
    prestamo: {}, cliente: {}, cobrador: {}, puedeAnular: false,
    anulacion: { fecha: new Date(`2026-0${id}-02`), motivo: 'OTRO', observacion: 'Correction' },
  })) }, {}, {}, {});
  const result = await controller.listarPorPrestamo(1);
  assert.deepEqual(result.map(payment => [payment.id, payment.estado, payment.puedeAnular]), [[1, EstadoPago.ANULADO, false], [2, EstadoPago.ANULADO, false], [3, EstadoPago.ANULADO, false]]);
});

test('loan payment listing uses one bulk query and does not perform N+1 reads', () => {
  assert.equal((repositorySource.match(/getRawAndEntities\(\)/g) || []).length, 1);
  assert.equal((repositorySource.match(/listarPorPrestamo[\s\S]*?getOne\(\)/g) || []).length, 0);
});
