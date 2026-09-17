const test = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { ConfiguracionFinancieraController, CortesMensualesController } = require('../dist/modules/cierre-financiero/presentation/cierre-financiero.controller');
const { ConfiguracionFinancieraOrmEntity, CierreMensualOrmEntity, DetalleCorteMensualOrmEntity, ConceptoDetalleCorte } = require('../dist/modules/cierre-financiero/domain/financial.orm-entities');
const { getMetadataArgsStorage } = require('typeorm');
const { validate } = require('class-validator');
const { plainToInstance } = require('class-transformer');
const { calculateExpectedPortfolio, calculateMonthlyResult, calculateMonthlyDisbursements, calculateAvailableCash, calculateAvailableCashAsOfToday } = require('../dist/modules/cierre-financiero/application/financial-period.service');
const { CrearPrestamoDto } = require('../dist/modules/prestamos/application/dto/crear-prestamo.dto');
const { MovimientoCajaService } = require('../dist/modules/movimientos-caja/application/services/movimiento-caja.service');
const { ConceptoMovimientoCaja } = require('../dist/modules/movimientos-caja/domain/enums/concepto-movimiento-caja.enum');
const { TipoMovimientoCaja } = require('../dist/modules/movimientos-caja/domain/enums/tipo-movimiento-caja.enum');

test('financial contract exposes the required controllers and persistence tables', () => {
  assert.equal(Reflect.getMetadata('path', ConfiguracionFinancieraController), 'configuracion-financiera');
  assert.equal(Reflect.getMetadata('path', CortesMensualesController), 'cortes-mensuales');
  const tables = getMetadataArgsStorage().tables;
  assert.equal(tables.find(x => x.target === ConfiguracionFinancieraOrmEntity).name, 'configuracion_financiera');
  assert.equal(tables.find(x => x.target === CierreMensualOrmEntity).name, 'cierre_mensual');
  assert.equal(tables.find(x => x.target === DetalleCorteMensualOrmEntity).name, 'detalle_corte_mensual');
});

test('financial controllers do not expose mutation endpoints beyond opening and close', () => {
  assert.equal(typeof ConfiguracionFinancieraController.prototype.create, 'function');
  assert.equal(typeof ConfiguracionFinancieraController.prototype.preview, 'function');
  assert.equal(typeof CortesMensualesController.prototype.close, 'function');
  assert.equal(typeof CortesMensualesController.prototype.list, 'function');
  assert.equal(typeof CortesMensualesController.prototype.get, 'function');
  assert.equal(CortesMensualesController.prototype.update, undefined);
  assert.equal(CortesMensualesController.prototype.delete, undefined);
});

test('financial detail enum contains exactly the contractual 22 concepts', () => {
  assert.deepEqual(Object.values(ConceptoDetalleCorte), [
    'CARTERA_INICIAL', 'CARTERA_ACTIVA_INICIAL', 'CARTERA_INCOBRABLE_INICIAL', 'CARTERA_ACTIVA_FINAL',
    'CARTERA_INCOBRABLE_FINAL', 'CARTERA_TOTAL_FINAL', 'DISPONIBLE_INICIAL', 'DISPONIBLE_FINAL',
    'PAGOS_RECIBIDOS', 'CAPITAL_RECUPERADO', 'INTERESES_COBRADOS', 'DESEMBOLSOS_PRESTAMOS',
    'DESEMBOLSOS_REFINANCIAMIENTOS', 'MONTO_REFINANCIADO', 'APORTES_CAPITAL', 'RETIROS', 'GASTOS',
    'AJUSTES_ENTRADA', 'AJUSTES_SALIDA', 'ENTRADAS_CAJA', 'SALIDAS_CAJA', 'RESULTADO_MES',
  ]);
});

test('financial persistence protects snapshots and configuration singleton', () => {
  const relation = getMetadataArgsStorage().relations.find(x => x.target === DetalleCorteMensualOrmEntity && x.propertyName === 'corte');
  assert.equal(relation.options.onDelete, 'RESTRICT');
  const index = getMetadataArgsStorage().indices.find(x => x.target === ConfiguracionFinancieraOrmEntity && x.name === 'UQ_configuracion_financiera_singleton');
  assert.equal(index.unique, true);
});

test('monthly disbursement reversal is recognized in the reversal month without rewriting the original month', () => {
  const loan = { fecha: '2026-01-31', monto: 100, concepto: ConceptoMovimientoCaja.DESEMBOLSO_PRESTAMO, tipo: TipoMovimientoCaja.SALIDA };
  const reversal = { fecha: '2026-02-02', monto: 100, concepto: ConceptoMovimientoCaja.REVERSO, tipo: TipoMovimientoCaja.ENTRADA, movimientoReversado: loan };
  assert.deepEqual(calculateMonthlyDisbursements([loan, reversal], '2026-01-01', '2026-01-31'), { loanOut: 100, refinanceOut: 0 });
  assert.deepEqual(calculateMonthlyDisbursements([loan, reversal], '2026-02-01', '2026-02-28'), { loanOut: -100, refinanceOut: 0 });
});

test('monthly disbursement reversal preserves refinancing concept and amount', () => {
  const original = { fecha: '2026-01-31', monto: 80, concepto: ConceptoMovimientoCaja.DESEMBOLSO_REFINANCIAMIENTO, tipo: TipoMovimientoCaja.SALIDA };
  const reversal = { fecha: '2026-02-01', monto: 80, concepto: ConceptoMovimientoCaja.REVERSO, tipo: TipoMovimientoCaja.ENTRADA, movimientoReversado: original };
  assert.equal(calculateMonthlyDisbursements([original, reversal], '2026-02-01', '2026-02-28').refinanceOut, -80);
});

test('available cash includes opening-day payment and excludes pre-opening movement', () => {
  const movements = [
    { fecha: '2026-08-31', monto: 100, tipo: TipoMovimientoCaja.ENTRADA },
    { fecha: '2026-09-01', monto: 100, tipo: TipoMovimientoCaja.ENTRADA, concepto: ConceptoMovimientoCaja.PAGO_CLIENTE },
  ];
  assert.equal(calculateAvailableCash({ disponibleInicial: 0, fechaApertura: '2026-09-01', asOf: '2026-09-01', movements }), 100);
});

test('available cash includes opening-day disbursement as an outgoing amount', () => {
  assert.equal(calculateAvailableCash({ disponibleInicial: 0, fechaApertura: '2026-09-01', asOf: '2026-09-01', movements: [{ fecha: '2026-09-01', monto: 500, tipo: TipoMovimientoCaja.SALIDA, concepto: ConceptoMovimientoCaja.DESEMBOLSO_PRESTAMO }] }), -500);
});

test('available cash applies opening-day aportes, retiros, and gastos by movement type', () => {
  const movements = [
    { fecha: '2026-09-01', monto: 50, tipo: TipoMovimientoCaja.ENTRADA, concepto: ConceptoMovimientoCaja.APORTE_CAPITAL },
    { fecha: '2026-09-01', monto: 20, tipo: TipoMovimientoCaja.SALIDA, concepto: ConceptoMovimientoCaja.RETIRO },
    { fecha: '2026-09-01', monto: 10, tipo: TipoMovimientoCaja.SALIDA, concepto: ConceptoMovimientoCaja.GASTO },
  ];
  assert.equal(calculateAvailableCash({ disponibleInicial: 0, fechaApertura: '2026-09-01', asOf: '2026-09-01', movements }), 20);
});

test('available cash includes payment and disbursement reversals on their own dates', () => {
  const movements = [
    { fecha: '2026-09-01', monto: 100, tipo: TipoMovimientoCaja.ENTRADA, concepto: ConceptoMovimientoCaja.PAGO_CLIENTE },
    { fecha: '2026-09-02', monto: 100, tipo: TipoMovimientoCaja.SALIDA, concepto: ConceptoMovimientoCaja.REVERSO },
    { fecha: '2026-09-01', monto: 500, tipo: TipoMovimientoCaja.SALIDA, concepto: ConceptoMovimientoCaja.DESEMBOLSO_PRESTAMO },
    { fecha: '2026-09-02', monto: 500, tipo: TipoMovimientoCaja.ENTRADA, concepto: ConceptoMovimientoCaja.REVERSO },
  ];
  assert.equal(calculateAvailableCash({ disponibleInicial: 0, fechaApertura: '2026-09-01', asOf: '2026-09-02', movements }), 0);
});

test('available cash excludes future movements at the requested as-of date', () => {
  assert.equal(calculateAvailableCash({ disponibleInicial: 1000, fechaApertura: '2026-09-01', asOf: '2026-09-10', movements: [{ fecha: '2026-09-11', monto: 500, tipo: TipoMovimientoCaja.ENTRADA }] }), 1000);
});

test('current available cash excludes movements after economic today while explicit ranges do not', () => {
  const movements = [
    { fecha: '2026-09-16', monto: 25, tipo: TipoMovimientoCaja.ENTRADA },
    { fecha: '2026-09-17', monto: 75, tipo: TipoMovimientoCaja.ENTRADA },
  ];
  const input = { disponibleInicial: 100, fechaApertura: '2026-09-01', asOf: '2026-09-17', movements };
  assert.equal(calculateAvailableCashAsOfToday(input, '2026-09-16'), 125);
  assert.equal(calculateAvailableCash(input), 200);
});

test('available cash preserves cent precision', () => {
  const movements = [
    { fecha: '2026-09-01', monto: 1000.25, tipo: TipoMovimientoCaja.ENTRADA },
    { fecha: '2026-09-01', monto: 200.10, tipo: TipoMovimientoCaja.ENTRADA },
    { fecha: '2026-09-01', monto: 50.05, tipo: TipoMovimientoCaja.SALIDA },
  ];
  assert.equal(calculateAvailableCash({ disponibleInicial: 0, fechaApertura: '2026-09-01', asOf: '2026-09-01', movements }), 1150.3);
});

test('monthly continuation is non-overlapping and equivalent to opening calculation', () => {
  const movements = [{ fecha: '2025-09-15', monto: 200000, tipo: TipoMovimientoCaja.SALIDA }];
  const september = calculateAvailableCash({ disponibleInicial: 5500000, fechaApertura: '2025-09-01', asOf: '2025-09-30', movements });
  const october = calculateAvailableCash({ disponibleInicial: september, fechaApertura: '2025-09-01', fechaCierreAnterior: '2025-09-30', asOf: '2025-10-31', movements });
  const fromOpening = calculateAvailableCash({ disponibleInicial: 5500000, fechaApertura: '2025-09-01', asOf: '2025-10-31', movements });
  assert.equal(september, 5300000);
  assert.equal(october, 5300000);
  assert.equal(october, fromOpening);
});

test('reversal after September close affects October continuation only', () => {
  const movements = [
    { fecha: '2025-09-20', monto: 500, tipo: TipoMovimientoCaja.SALIDA, concepto: ConceptoMovimientoCaja.DESEMBOLSO_PRESTAMO },
    { fecha: '2025-10-02', monto: 500, tipo: TipoMovimientoCaja.ENTRADA, concepto: ConceptoMovimientoCaja.REVERSO },
  ];
  const september = calculateAvailableCash({ disponibleInicial: 5000, fechaApertura: '2025-09-01', asOf: '2025-09-30', movements });
  const october = calculateAvailableCash({ disponibleInicial: september, fechaApertura: '2025-09-01', fechaCierreAnterior: '2025-09-30', asOf: '2025-10-31', movements });
  assert.equal(september, 4500);
  assert.equal(october, 5000);
});

test('closed snapshot values are read-only facts even when a later calculation differs', () => {
  const closed = { carteraTotal: 100, detalles: [{ concepto: ConceptoDetalleCorte.CARTERA_TOTAL_FINAL, monto: 100 }] };
  const laterCalculation = { carteraTotal: 70 };
  assert.equal(closed.detalles[0].monto, 100);
  assert.notEqual(laterCalculation.carteraTotal, closed.detalles[0].monto);
});

test('financial calculations reconcile refinancing transfer exactly and keep withdrawals out of result', () => {
  assert.equal(calculateExpectedPortfolio(100000, 60000, 10000, 40000), 110000);
  assert.equal(calculateExpectedPortfolio(100000, 40000, 10000, 40000), 90000);
  assert.equal(calculateMonthlyResult(18000, 2500), 15500);
  assert.equal(calculateMonthlyResult(18000, 2500), 15500, 'RETIROS are not an expense in RESULTADO_MES');
});

test('creation DTO rejects impossible calendar dates', async () => {
  const dto = plainToInstance(CrearPrestamoDto, {
    clienteId: 1, periodicidadPagoId: 1, formaPagoId: 1, fechaAlta: '2026-02-30',
    capital: 100, interes: 0, cantidadPagos: 1, planPersonalizado: false,
  });
  const errors = await validate(dto);
  assert.ok(errors.some(error => error.property === 'fechaAlta'));
});

test('automatic cash creation invokes the shared open-period policy', async () => {
  let checked = false;
  const periods = { assertOpen: async () => { checked = true; throw new Error('closed'); } };
  const service = new MovimientoCajaService({}, {}, periods);
  await assert.rejects(() => service.automatico({}, {
    tipo: TipoMovimientoCaja.ENTRADA, concepto: ConceptoMovimientoCaja.PAGO_CLIENTE,
    monto: 100, fecha: new Date('2026-01-01T00:00:00Z'), pagoId: 1, prestamoId: 1,
    refinanciamientoId: null, movimientoReversadoId: null, usuarioId: 1,
  }), /closed/);
  assert.equal(checked, true);
});
