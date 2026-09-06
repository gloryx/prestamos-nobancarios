const assert = require('node:assert/strict');
const test = require('node:test');

const { BadRequestException } = require('@nestjs/common');
const { GeneradorPlanPago } = require('../dist/modules/planes-pago/domain/services/generador-plan-pago');
const { convertirYValidarCuotas } = require('../dist/modules/planes-pago/application/use-cases/validar-plan-pago');
const { Prestamo } = require('../dist/modules/prestamos/domain/entities/prestamo');

const date = (value) => new Date(`${value}T00:00:00.000Z`);
const loan = (fechaAlta, cantidadPagos, periodicidad) => Object.assign(
  Prestamo.crear({ clienteId: 1, periodicidadPagoId: 1, formaPagoId: 1, fechaAlta: date(fechaAlta), capital: 100, interes: 0, cantidadPagos, planPersonalizado: false }),
  { id: 1, periodicidadPago: { nombre: periodicidad } },
);
const dates = (plan) => plan.map((payment) => payment.fechaVencimiento.toISOString().slice(0, 10));

test('daily plans cross Sunday without duplicating Monday', () => {
  const result = dates(GeneradorPlanPago.generar(loan('2026-09-04', 4, 'DIARIO')));
  assert.deepEqual(result, ['2026-09-05', '2026-09-07', '2026-09-08', '2026-09-09']);
  assert.equal(new Set(result).size, result.length);
});

for (const [periodicidad, fechaAlta] of [['SEMANAL', '2026-08-30'], ['QUINCENAL', '2026-08-22'], ['MENSUAL', '2026-08-06']]) {
  test(`${periodicidad.toLowerCase()} plans move Sunday due dates to Monday`, () => {
    const result = dates(GeneradorPlanPago.generar(loan(fechaAlta, 2, periodicidad)));
    assert.equal(result[0], '2026-09-07');
    assert.ok(result[1] > result[0]);
    assert.ok(result.every((value) => date(value).getUTCDay() !== 0));
  });
}

test('generated dates are strictly increasing', () => {
  const result = dates(GeneradorPlanPago.generar(loan('2026-09-04', 20, 'DIARIO')));
  assert.ok(result.every((value, index) => index === 0 || value > result[index - 1]));
});

const customLoan = (cuotas) => loan('2026-09-04', cuotas.length, 'DIARIO');
const cuota = (numeroPago, fechaVencimiento) => ({ numeroPago, fechaVencimiento, montoProgramado: 100 / 2 });

test('customized plans reject Sunday installments with HTTP 400', () => {
  assert.throws(() => convertirYValidarCuotas(customLoan([cuota(1, '2026-09-06'), cuota(2, '2026-09-07')]), [cuota(1, '2026-09-06'), cuota(2, '2026-09-07')]), (error) => {
    assert.ok(error instanceof BadRequestException);
    assert.equal(error.getStatus(), 400);
    assert.equal(error.message, 'Las cuotas del plan de pagos no pueden programarse en domingo.');
    return true;
  });
});

test('customized plans without Sunday installments are accepted', () => {
  const result = convertirYValidarCuotas(customLoan([cuota(1, '2026-09-05'), cuota(2, '2026-09-07')]), [cuota(1, '2026-09-05'), cuota(2, '2026-09-07')]);
  assert.deepEqual(dates(result), ['2026-09-05', '2026-09-07']);
});
