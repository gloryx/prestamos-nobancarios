const test = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { getMetadataArgsStorage } = require('typeorm');
const { CrearPrestamoDto } = require('../dist/modules/prestamos/application/dto/crear-prestamo.dto');
const { CrearRefinanciamientoDto } = require('../dist/modules/refinanciamientos/application/dto/crear-refinanciamiento.dto');
const { Prestamo } = require('../dist/modules/prestamos/domain/entities/prestamo');
const { PrestamoOrmEntity } = require('../dist/modules/prestamos/infrastructure/persistence/typeorm/prestamo.orm-entity');
const { PrestamoReferences } = require('../dist/modules/prestamos/application/use-cases/prestamo-references');
const { MovimientoCaja } = require('../dist/modules/movimientos-caja/domain/entities/movimiento-caja');
const { MovimientoCajaOrmEntity } = require('../dist/modules/movimientos-caja/infrastructure/persistence/typeorm/movimiento-caja.orm-entity');
const { MovimientoCajaMapper } = require('../dist/modules/movimientos-caja/infrastructure/persistence/typeorm/movimiento-caja.mapper');
const { ConceptoMovimientoCaja: C } = require('../dist/modules/movimientos-caja/domain/enums/concepto-movimiento-caja.enum');
const { TipoMovimientoCaja: T } = require('../dist/modules/movimientos-caja/domain/enums/tipo-movimiento-caja.enum');

const dto = (extra = {}) => plainToInstance(CrearPrestamoDto, {
  clienteId: 1, periodicidadPagoId: 1, formaPagoId: 1, formaDesembolsoId: 2,
  fechaAlta: '2026-09-04', capital: 100, interes: 10, cantidadPagos: 1,
  planPersonalizado: false, ...extra,
});

test('creation DTO requires a positive disbursement payment method', async () => {
  assert.ok((await validate(dto({ formaDesembolsoId: undefined }))).some(error => error.property === 'formaDesembolsoId'));
  assert.ok((await validate(dto({ formaDesembolsoId: 0 }))).some(error => error.property === 'formaDesembolsoId'));
});

test('refinancing DTO conditionally requires a positive disbursement method', async () => {
  const base = { prestamoOrigenId: 1, periodicidadPagoId: 1, formaPagoId: 1, fecha: '2026-09-04', montoNuevoDesembolsado: 100, interesNuevo: 10, cantidadPagos: 1, planPersonalizado: false };
  assert.ok((await validate(plainToInstance(CrearRefinanciamientoDto, base))).some(error => error.property === 'formaDesembolsoId'));
  assert.equal((await validate(plainToInstance(CrearRefinanciamientoDto, { ...base, formaDesembolsoId: 2 }))).length, 0);
  assert.equal((await validate(plainToInstance(CrearRefinanciamientoDto, { ...base, montoNuevoDesembolsado: 0 }))).length, 0);
});

test('loan keeps payment and disbursement methods distinct', () => {
  const loan = Prestamo.crear({ ...dto(), fechaAlta: new Date('2026-09-04T00:00:00Z') });
  assert.equal(loan.formaPagoId, 1);
  assert.equal(loan.formaDesembolsoId, 2);
});

test('loan and cash movement expose nullable restricted FormaPago relations', () => {
  const relations = getMetadataArgsStorage().relations;
  assert.equal(relations.find(value => value.target === PrestamoOrmEntity && value.propertyName === 'formaDesembolso').options.onDelete, 'RESTRICT');
  assert.equal(relations.find(value => value.target === MovimientoCajaOrmEntity && value.propertyName === 'formaPago').options.onDelete, 'RESTRICT');
  const column = getMetadataArgsStorage().columns.find(value => value.target === MovimientoCajaOrmEntity && value.propertyName === 'formaPagoId');
  assert.equal(column.options.nullable, true);
});

test('references reject an invalid or inactive disbursement method', async () => {
  const forms = { buscarPorId: async id => id === 1 ? { activo: true } : id === 2 ? { activo: false } : null };
  const references = new PrestamoReferences({ buscarPorId: async () => ({ activo: true }) }, { buscarPorId: async () => ({ activo: true }) }, forms);
  await assert.rejects(() => references.validar(1, 1, 1, 9), /Forma de pago no encontrada/);
  await assert.rejects(() => references.validar(1, 1, 1, 2), /inactiva/);
});

test('loan disbursement movement preserves the disbursement method', () => {
  const movement = MovimientoCaja.crear({ tipo: T.SALIDA, concepto: C.DESEMBOLSO_PRESTAMO, monto: 100, fecha: new Date('2026-09-04T00:00:00Z'), formaPagoId: 2, prestamoId: 7, usuarioId: 1 });
  const orm = MovimientoCajaMapper.toOrm(movement);
  assert.equal(movement.formaPagoId, 2);
  assert.equal(orm.formaPagoId, 2);
});
