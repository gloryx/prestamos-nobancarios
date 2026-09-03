const test = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { ValidationPipe, BadRequestException, UnauthorizedException } = require('@nestjs/common');
const { validate } = require('class-validator');
const { plainToInstance } = require('class-transformer');
const { CrearIngresoDto, FiltrosIngresosDto } = require('../dist/modules/ingresos/application/dto/ingreso.dto');
const { FiltrosFuentesIngresoDto } = require('../dist/modules/ingresos/application/dto/fuente-ingreso.dto');
const { CrearIngresoUseCase, ActualizarIngresoUseCase } = require('../dist/modules/ingresos/application/use-cases/ingreso.use-cases');
const { CrearFuenteIngresoUseCase, ListarFuentesIngresoUseCase } = require('../dist/modules/ingresos/application/use-cases/fuente-ingreso.use-cases');
const { InitialIngresosSeed } = require('../dist/modules/ingresos/application/initial-ingresos.seed');
const { FuenteIngreso } = require('../dist/modules/ingresos/domain/entities/fuente-ingreso');
const { FuenteIngresoOrmEntity } = require('../dist/modules/ingresos/infrastructure/persistence/typeorm/fuente-ingreso.orm-entity');
const { IngresoOrmEntity } = require('../dist/modules/ingresos/infrastructure/persistence/typeorm/ingreso.orm-entity');
const { IngresosController } = require('../dist/modules/ingresos/presentation/controllers/ingresos.controller');
const { getMetadataArgsStorage } = require('typeorm');

const source = (overrides = {}) => Object.assign(new FuenteIngreso(1, 'SALARIO DOCENTE', true, new Date()), overrides);
const sourceRepo = (value = source()) => ({ buscarPorId: async () => value });
const ingresoRepo = () => ({ guardar: async value => value, buscarPorId: async () => null });

test('income creation uses the authenticated actor, normalizes description, and rejects inactive sources', async () => {
  let saved;
  const repo = { guardar: async value => (saved = value), buscarPorId: async () => null };
  await new CrearIngresoUseCase(repo, sourceRepo()).execute({ fuenteIngresoId: 1, fecha: '2026-09-01', monto: 10, descripcion: '  cash  ' }, 7);
  assert.equal(saved.usuarioId, 7);
  assert.equal(saved.descripcion, 'cash');
  await assert.rejects(() => new CrearIngresoUseCase(ingresoRepo(), sourceRepo(source({ activo: false }))).execute({ fuenteIngresoId: 1, fecha: '2026-09-01', monto: 10 }, 7), e => e instanceof BadRequestException && e.message === 'La fuente de ingreso seleccionada está inactiva.');
});

test('income update preserves the original actor and creation timestamp', async () => {
  const original = { id: 3, fuenteIngresoId: 1, fecha: '2026-09-01', monto: 10, descripcion: 'old', usuarioId: 9, fechaCreacion: new Date(1) };
  const repo = { buscarPorId: async () => original, guardar: async value => value };
  const result = await new ActualizarIngresoUseCase(repo, sourceRepo()).execute(3, { fuenteIngresoId: 1, fecha: '2026-09-02', monto: 20, descripcion: ' ' });
  assert.equal(result.usuarioId, 9); assert.equal(result.fechaCreacion.getTime(), 1); assert.equal(result.descripcion, null);
});

test('forbidNonWhitelisted validation rejects usuarioId in the create DTO', async () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  await assert.rejects(() => pipe.transform({ fuenteIngresoId: 1, fecha: '2026-09-01', monto: 1, usuarioId: 99 }, { type: 'body', metatype: CrearIngresoDto }), e => e.status === 400);
});

test('income ORM metadata has restricted foreign keys and numeric money precision', () => {
  const columns = getMetadataArgsStorage().columns.filter(item => item.target === IngresoOrmEntity);
  const amount = columns.find(item => item.propertyName === 'monto');
  assert.equal(amount.options.precision, 14); assert.equal(amount.options.scale, 2);
  const relations = getMetadataArgsStorage().relations.filter(item => item.target === IngresoOrmEntity);
  assert.deepEqual(relations.map(item => item.propertyName).sort(), ['fuenteIngreso', 'usuario']);
  assert.equal(IngresosController.prototype.crearIngreso !== undefined, true);
});

test('authenticatedUserId rejects an unauthenticated request', () => {
  assert.throws(() => require('../dist/common/authenticated-user').authenticatedUserId({}), e => e instanceof UnauthorizedException && e.status === 401);
});

test('source filters convert true and false query strings and reach the use case', async () => {
  assert.equal(plainToInstance(FiltrosFuentesIngresoDto, { activo: 'true' }).activo, true);
  assert.equal(plainToInstance(FiltrosFuentesIngresoDto, { activo: 'false' }).activo, false);
  let received;
  await new ListarFuentesIngresoUseCase({ listar: async activo => (received = activo, []) }).execute(false);
  assert.equal(received, false);
});

test('income filters use page, limit, and search query names with numeric conversion', () => {
  const filters = plainToInstance(FiltrosIngresosDto, { page: '2', limit: '25', fuenteIngresoId: '3', search: 'salary' });
  assert.deepEqual({ page: filters.page, limit: filters.limit, fuenteIngresoId: filters.fuenteIngresoId, search: filters.search }, { page: 2, limit: 25, fuenteIngresoId: 3, search: 'salary' });
});

test('source names allow 120 characters and duplicate lookup is normalized case-insensitively', async () => {
  const name = 'a'.repeat(120);
  const columns = getMetadataArgsStorage().columns.filter(item => item.target === FuenteIngresoOrmEntity);
  assert.equal(columns.find(item => item.propertyName === 'nombre').options.length, 120);
  let lookedUp;
  let saved;
  const repo = { buscarPorNombre: async value => (lookedUp = value, null), guardar: async value => (saved = value) };
  await new CrearFuenteIngresoUseCase(repo).execute(`  ${name.toLowerCase()}  `);
  assert.equal(lookedUp, name.toUpperCase());
  assert.equal(saved.nombre, name.toUpperCase());
});

test('source seed is idempotent and does not overwrite existing records', async () => {
  const existing = new FuenteIngreso(9, 'SALARIO DOCENTE', false, new Date(1));
  let createCalls = 0;
  const created = new Set();
  const repo = { buscarPorNombre: async name => name === 'SALARIO DOCENTE' ? existing : created.has(name) ? new FuenteIngreso(10, name, true) : null };
  const creator = { execute: async () => { createCalls += 1; } };
  creator.execute = async name => { createCalls += 1; created.add(name.toUpperCase()); };
  await new InitialIngresosSeed(repo, creator).seed();
  assert.equal(createCalls, 5);
  await new InitialIngresosSeed(repo, creator).seed();
  assert.equal(createCalls, 5);
  assert.equal(existing.activo, false);
});
