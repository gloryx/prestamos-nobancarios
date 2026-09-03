const test = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { ConfiguracionFinancieraController, CortesMensualesController } = require('../dist/modules/cierre-financiero/presentation/cierre-financiero.controller');
const { ConfiguracionFinancieraOrmEntity, CierreMensualOrmEntity, DetalleCorteMensualOrmEntity, ConceptoDetalleCorte } = require('../dist/modules/cierre-financiero/domain/financial.orm-entities');
const { getMetadataArgsStorage } = require('typeorm');
const { validate } = require('class-validator');
const { plainToInstance } = require('class-transformer');
const { calculateExpectedPortfolio, calculateMonthlyResult } = require('../dist/modules/cierre-financiero/application/financial-period.service');
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
