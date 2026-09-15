const assert = require('node:assert/strict');
const test = require('node:test');
require('reflect-metadata');

const { BadRequestException } = require('@nestjs/common');
const { ActualizarPrestamoUseCase } = require('../dist/modules/prestamos/application/use-cases/actualizar-prestamo.use-case');
const { Prestamo } = require('../dist/modules/prestamos/domain/entities/prestamo');
const { EstadoPrestamo } = require('../dist/modules/prestamos/domain/enums/estado-prestamo.enum');

const message = 'Un préstamo refinanciado no permite modificar datos contractuales o financieros. Solo puede actualizarse la observación.';

function loan(state) {
  const value = Prestamo.crear({
    clienteId: 1, periodicidadPagoId: 2, formaPagoId: 3, formaDesembolsoId: 4,
    fechaAlta: new Date('2026-01-10T00:00:00.000Z'), capital: 1000.10, interes: 200.20,
    cantidadPagos: 4, planPersonalizado: false, observaciones: 'ORIGINAL',
  });
  Object.assign(value, { id: 7, estado: state, montoDesembolsado: 1000.10, cliente: {}, periodicidadPago: {}, formaPago: {}, formaDesembolso: {} });
  return value;
}

function harness(value) {
  const calls = { references: 0, payments: 0, updates: 0 };
  const repository = {
    buscarPorId: async id => { assert.equal(id, 7); return value; },
    actualizar: async current => { calls.updates += 1; return current; },
  };
  const references = { validar: async () => { calls.references += 1; } };
  const pagos = { obtenerTotalesPorPrestamo: async () => { calls.payments += 1; return { capital: 0, interes: 0, total: 0 }; } };
  return { useCase: new ActualizarPrestamoUseCase(repository, references, pagos), calls };
}

test('REFINANCIADO permite actualizar únicamente observaciones', async () => {
  const value = loan(EstadoPrestamo.REFINANCIADO);
  const h = harness(value);
  const updated = await h.useCase.execute(7, { observaciones: '  nueva observación  ' });
  assert.equal(updated.observaciones, 'NUEVA OBSERVACIÓN');
  assert.equal(h.calls.references, 0);
  assert.equal(h.calls.payments, 0);
});

test('REFINANCIADO rechaza cambios contractuales y financieros', async t => {
  const changes = {
    clienteId: 9, fechaAlta: '2026-01-11', capital: 1000.11, interes: 200.21,
    periodicidadPagoId: 9, cantidadPagos: 5, formaPagoId: 9, formaDesembolsoId: 9,
    planPersonalizado: true, cuotas: [],
  };
  for (const [field, value] of Object.entries(changes)) await t.test(field, async () => {
    await assert.rejects(() => harness(loan(EstadoPrestamo.REFINANCIADO)).useCase.execute(7, { [field]: value }), error => error instanceof BadRequestException && error.message === message);
  });
});

test('REFINANCIADO permite los mismos valores bloqueados junto con observaciones', async () => {
  const value = loan(EstadoPrestamo.REFINANCIADO);
  const h = harness(value);
  const updated = await h.useCase.execute(7, {
    clienteId: 1, fechaAlta: '2026-01-10', capital: 1000.10001, interes: 200.19999,
    periodicidadPagoId: 2, cantidadPagos: 4, formaPagoId: 3, formaDesembolsoId: 4,
    planPersonalizado: false, observaciones: 'CAMBIO PERMITIDO',
  });
  assert.equal(updated.observaciones, 'CAMBIO PERMITIDO');
  assert.equal(h.calls.updates, 1);
});

test('ACTIVO e INCOBRABLE mantienen la edición vigente', async t => {
  for (const state of [EstadoPrestamo.ACTIVO, EstadoPrestamo.INCOBRABLE]) await t.test(state, async () => {
    const updated = await harness(loan(state)).useCase.execute(7, { capital: 1200, interes: 250 });
    assert.equal(updated.capital, 1200);
    assert.equal(updated.interes, 250);
  });
});

test('CANCELADO y ANULADO siguen bloqueados', async () => {
  for (const state of [EstadoPrestamo.CANCELADO, EstadoPrestamo.ANULADO]) {
    await assert.rejects(() => harness(loan(state)).useCase.execute(7, { observaciones: 'NO' }), BadRequestException);
  }
});

test('la decisión usa el estado del préstamo, no una cadena de refinanciamiento', async () => {
  const value = loan(EstadoPrestamo.ACTIVO);
  value.prestamoNuevoId = 999;
  const h = harness(value);
  const updated = await h.useCase.execute(7, { capital: 1200 });
  assert.equal(updated.capital, 1200);
  assert.equal(h.calls.references, 1);
  assert.equal(h.calls.payments, 1);
});
