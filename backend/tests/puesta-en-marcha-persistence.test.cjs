const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getMetadataArgsStorage } = require('typeorm');
const entities = require('../dist/modules/cierre-financiero/infrastructure/persistence/typeorm/puesta-en-marcha.orm-entities');
const { PuestaEnMarchaMapper } = require('../dist/modules/cierre-financiero/infrastructure/persistence/typeorm/puesta-en-marcha.mapper');
const { PuestaEnMarchaTypeOrmRepository } = require('../dist/modules/cierre-financiero/infrastructure/persistence/typeorm/puesta-en-marcha.typeorm-repository');
const { CierreFinancieroModule } = require('../dist/modules/cierre-financiero/cierre-financiero.module');
const { PUESTA_EN_MARCHA_REPOSITORY } = require('../dist/modules/cierre-financiero/domain/repositories/puesta-en-marcha.repository');
const domain = require('../dist/modules/cierre-financiero/domain/puesta-en-marcha');

const { ConceptoSaldoPuesta: C, ModalidadPuestaEnMarcha: M, ProcedenciaSaldo: P } = domain;

test('registers exact ORM tables, columns, enums, relations and constraints', () => {
  const tables = getMetadataArgsStorage().tables.filter((item) => [entities.PuestaMarchaFinancieraOrmEntity, entities.PuestaMarchaFinancieraSaldoOrmEntity].includes(item.target));
  assert.deepEqual(tables.map((item) => item.name), ['puesta_marcha_financiera', 'puesta_marcha_financiera_saldo']);
  const columns = getMetadataArgsStorage().columns.filter((item) => tables.some((table) => table.target === item.target));
  assert.ok(columns.some((item) => item.target === entities.PuestaMarchaFinancieraOrmEntity && item.propertyName === 'fechaBase' && item.options.type === 'date'));
  assert.ok(columns.some((item) => item.target === entities.PuestaMarchaFinancieraOrmEntity && item.propertyName === 'fechaInicioCierres' && item.options.type === 'date'));
  assert.ok(columns.some((item) => item.target === entities.PuestaMarchaFinancieraSaldoOrmEntity && item.propertyName === 'monto' && item.options.precision === 14 && item.options.scale === 2));
  const uniques = getMetadataArgsStorage().uniques.filter((item) => tables.some((table) => table.target === item.target));
  assert.deepEqual(uniques.map((item) => item.name).sort(), ['UQ_puesta_marcha_financiera_configuracion', 'UQ_puesta_marcha_financiera_saldo_concepto']);
  const checks = getMetadataArgsStorage().checks.filter((item) => tables.some((table) => table.target === item.target));
  assert.deepEqual(checks.map((item) => item.name).sort(), ['CHK_puesta_marcha_financiera_fechas', 'CHK_puesta_marcha_financiera_saldo_monto']);
});

test('mapper preserves date-only values and converts numeric strings', () => {
  const entity = new entities.PuestaMarchaFinancieraOrmEntity();
  Object.assign(entity, { modalidad: M.NEGOCIO_NUEVO, fechaBase: '2026-01-31', fechaInicioCierres: '2026-02-01', observaciones: null, saldos: [] });
  const saldo = new entities.PuestaMarchaFinancieraSaldoOrmEntity();
  Object.assign(saldo, { concepto: C.DISPONIBLE, monto: '12.34', procedencia: P.DECLARADO, evidencia: null, observacion: null });
  entity.saldos = [saldo];
  const result = PuestaEnMarchaMapper.toDomain(entity);
  assert.equal(result.fechaBase, '2026-01-31');
  assert.equal(result.fechaInicioCierres, '2026-02-01');
  assert.equal(result.saldos[0].monto, 12.34);
});

test('registers repository token/provider and both entities in the module and CLI data source', () => {
  const providers = Reflect.getMetadata('providers', CierreFinancieroModule) ?? [];
  assert.ok(providers.some((provider) => provider && provider.provide === PUESTA_EN_MARCHA_REPOSITORY && provider.useClass === PuestaEnMarchaTypeOrmRepository));
  const dataSourceSource = fs.readFileSync(path.join(__dirname, '../src/database/data-source.ts'), 'utf8');
  assert.match(dataSourceSource, /PuestaMarchaFinancieraOrmEntity/);
  assert.match(dataSourceSource, /PuestaMarchaFinancieraSaldoOrmEntity/);
});

test('repository is append-once and persists parent plus four saldo rows through the supplied manager', () => {
  const calls = [];
  const parent = { save: async (value) => { calls.push(['parent.save', value]); value.id = 7; value.fechaCreacion = new Date('2026-02-01T00:00:00Z'); return value; }, count: async () => 0, createQueryBuilder: () => { throw new Error('not needed'); } };
  const saldo = { save: async (values) => { calls.push(['saldo.save', values]); return values; } };
  const manager = { getRepository: (type) => type === entities.PuestaMarchaFinancieraOrmEntity ? parent : saldo };
  const repository = new PuestaEnMarchaTypeOrmRepository();
  assert.deepEqual(Object.getOwnPropertyNames(PuestaEnMarchaTypeOrmRepository.prototype).filter((name) => ['create', 'existsByConfiguracionId', 'findByConfiguracionId'].includes(name)).sort(), ['create', 'existsByConfiguracionId', 'findByConfiguracionId']);
  const input = { modalidad: M.NEGOCIO_NUEVO, fechaBase: '2026-01-31', fechaInicioCierres: '2026-02-01', saldos: [
    { concepto: C.DISPONIBLE, monto: 1, procedencia: P.DECLARADO },
    { concepto: C.CARTERA_TOTAL, monto: 0, procedencia: P.NO_APLICA },
    { concepto: C.CARTERA_ACTIVA, monto: 0, procedencia: P.NO_APLICA },
    { concepto: C.CARTERA_INCOBRABLE, monto: 0, procedencia: P.NO_APLICA },
  ] };
  return repository.create(manager, { configuracionFinancieraId: 2, usuarioConfirmacionId: 3, puestaEnMarcha: input, fechaConfirmacion: new Date('2026-02-01T00:00:00Z') }).then((result) => {
    assert.equal(result.id, 7);
    assert.equal(calls[0][0], 'parent.save');
    assert.equal(calls[1][0], 'saldo.save');
    assert.equal(calls[1][1].length, 4);
  });
});

test('migration creates schema only and does not seed puesta records', () => {
  const migration = require('../dist/database/migrations/20260918160000-AddPuestaMarchaFinanciera').AddPuestaMarchaFinanciera20260918160000;
  assert.equal(migration.toString().includes('INSERT INTO'), false);
  assert.equal(migration.toString().includes('fecha_base'), true);
});
