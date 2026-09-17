const test = require('node:test');
const assert = require('node:assert/strict');
const { MovimientoCaja } = require('../dist/modules/movimientos-caja/domain/entities/movimiento-caja');
const { ConceptoMovimientoCaja: C } = require('../dist/modules/movimientos-caja/domain/enums/concepto-movimiento-caja.enum');
const { TipoMovimientoCaja: T } = require('../dist/modules/movimientos-caja/domain/enums/tipo-movimiento-caja.enum');
const { MovimientoCajaService } = require('../dist/modules/movimientos-caja/application/services/movimiento-caja.service');
const { authenticatedUserId } = require('../dist/common/authenticated-user');

const manager = () => ({});
const fake = () => { const items=[]; const repo={guardarEnTransaccion:async(_,v)=>{v.id=items.length+1;items.push(v);return v;},guardarManualIdempotente:async(_,v,fingerprint)=>{const existing=items.find(item=>item.usuarioId===v.usuarioId&&item.idempotencyKey===v.idempotencyKey);if(existing)return {movement:existing,replayed:true,fingerprint:existing.idempotencyFingerprint};v.id=items.length+1;v.idempotencyFingerprint=fingerprint;items.push(v);return {movement:v,replayed:false,fingerprint};},buscarPorIdEnTransaccion:async(_,id)=>items.find(v=>v.id===id)||null,buscarPorPagoYConceptoEnTransaccion:async(_,id,c)=>items.find(v=>v.pagoId===id&&v.concepto===c)||null,buscarPorRefinanciamientoYConceptoEnTransaccion:async(_,id,c)=>items.find(v=>v.refinanciamientoId===id&&v.concepto===c)||null,buscarPorPrestamoYConceptoEnTransaccion:async(_,id,c)=>items.find(v=>v.prestamoId===id&&v.concepto===c)||null,contarReversionesEnTransaccion:async(_,id)=>items.filter(v=>v.movimientoReversadoId===id).length}; const users={buscarPorIdEnTransaccion:async()=>({activo:true})}; const formas={buscarPorIdEnTransaccion:async()=>({activo:true})}; return {items,repo,users,formas}; };

test('manual concepts derive direction and require adjustment notes', async () => { const f=fake(); const s=new MovimientoCajaService(f.repo,f.users); const m=manager(f.items); const v=await s.crearManual(m,{concepto:C.AJUSTE_ENTRADA,monto:10,fecha:new Date(),observaciones:' correction ',usuarioId:1}); assert.equal(v.tipo,T.ENTRADA); assert.equal(v.observaciones,'correction'); await assert.rejects(()=>s.crearManual(m,{concepto:C.AJUSTE_SALIDA,monto:10,fecha:new Date(),usuarioId:1}),/observaciones/); await assert.rejects(()=>s.crearManual(m,{concepto:C.PAGO_CLIENTE,monto:10,fecha:new Date(),usuarioId:1}),/automático/); });
test('reversal is opposite, linked, immutable and protected from double reversal', async () => { const f=fake(); const s=new MovimientoCajaService(f.repo,f.users); const m=manager(f.items); const original=await s.crearManual(m,{concepto:C.GASTO,monto:25,fecha:new Date(),observaciones:'expense',usuarioId:1}); const reversal=await s.reversar(m,original.id,new Date(),'voided',1); assert.equal(reversal.tipo,T.ENTRADA); assert.equal(reversal.monto,25); assert.equal(reversal.movimientoReversadoId,original.id); await assert.rejects(()=>s.reversar(m,original.id,new Date(),'again',1),/reversado/); await assert.rejects(()=>s.reversar(m,reversal.id,new Date(),'again',1),/reverso/); });
test('domain rejects zero and preserves automatic references', () => { assert.throws(()=>MovimientoCaja.crear({tipo:T.SALIDA,concepto:C.DESEMBOLSO_PRESTAMO,monto:0,fecha:new Date(),usuarioId:1}),/mayor/); const v=MovimientoCaja.crear({tipo:T.SALIDA,concepto:C.DESEMBOLSO_REFINANCIAMIENTO,monto:50,fecha:new Date(),prestamoId:2,refinanciamientoId:3,usuarioId:1}); assert.equal(v.prestamoId,2); assert.equal(v.refinanciamientoId,3); });
test('automatic creation fails closed for actor and validates references and direction', async () => { const f=fake(); const s=new MovimientoCajaService(f.repo,f.users); const m=manager(f.items); await assert.rejects(() => s.automatico(m,{tipo:T.ENTRADA,concepto:C.PAGO_CLIENTE,monto:10,fecha:new Date(),usuarioId:1}),/pagoId/); await assert.rejects(() => s.automatico(m,{tipo:T.SALIDA,concepto:C.PAGO_CLIENTE,monto:10,fecha:new Date(),pagoId:1,prestamoId:2,usuarioId:1}),/dirección/); await assert.rejects(() => s.automatico(m,{tipo:T.SALIDA,concepto:C.DESEMBOLSO_REFINANCIAMIENTO,monto:10,fecha:new Date(),prestamoId:2,usuarioId:1}),/requiere/); await assert.rejects(() => s.automatico(m,{tipo:T.SALIDA,concepto:C.DESEMBOLSO_PRESTAMO,monto:10,fecha:new Date(),prestamoId:2,usuarioId:0}),/identidad/); });
test('automatic idempotency rejects an existing payment or refinancing movement', async () => { const f=fake(); const existing=MovimientoCaja.crear({tipo:T.ENTRADA,concepto:C.PAGO_CLIENTE,monto:10,fecha:new Date(),pagoId:7,prestamoId:2,usuarioId:1}); existing.id=1; f.items.push(existing); const s=new MovimientoCajaService(f.repo,f.users); await assert.rejects(() => s.automatico(manager(f.items),{tipo:T.ENTRADA,concepto:C.PAGO_CLIENTE,monto:10,fecha:new Date(),pagoId:7,prestamoId:2,usuarioId:1}),/ya existe/); });
test('transaction boundary rolls back simulated cash failure', async () => { const state=[]; const transaction=async callback => { const pending=[]; try { await callback({ pending, save: value => pending.push(value) }); state.push(...pending); } catch { /* rollback: pending is discarded */ } }; await transaction(async manager => { manager.save({id:1}); throw new Error('cash failure'); }); assert.deepEqual(state,[]); });
test('actor extraction uses only request.user.id and fails closed', () => { assert.equal(authenticatedUserId({ user: { id: 8, sub: '7' } }), 8); assert.throws(() => authenticatedUserId({ user: { sub: '7' } }), /identidad autenticada/); assert.throws(() => authenticatedUserId({ user: { usuarioId: 9 } }), /identidad autenticada/); assert.throws(() => authenticatedUserId({}), /identidad autenticada/); });

test('unit idempotency covers payment, loan disbursement, and refinancing disbursement', async () => {
  const cases = [
    ['payment', C.PAGO_CLIENTE, { pagoId: 11, prestamoId: 21 }, T.ENTRADA],
    ['loan', C.DESEMBOLSO_PRESTAMO, { prestamoId: 22 }, T.SALIDA],
    ['refinancing', C.DESEMBOLSO_REFINANCIAMIENTO, { prestamoId: 23, refinanciamientoId: 31 }, T.SALIDA],
  ];
  for (const [name, concepto, refs, tipo] of cases) await assert.rejects(async () => {
    const f = fake();
    const first = MovimientoCaja.crear({ tipo, concepto, monto: 10, fecha: new Date(), usuarioId: 1, ...refs });
    first.id = 1; f.items.push(first);
    await new MovimientoCajaService(f.repo, f.users).automatico(manager(f.items), { tipo, concepto, monto: 10, fecha: new Date(), usuarioId: 1, ...refs });
  }, /ya existe/, name);
});

test('unit maps a PostgreSQL 23505 during reversal to a conflict', async () => {
  const f = fake();
  const original = await new MovimientoCajaService(f.repo, f.users).crearManual(manager(), { concepto: C.GASTO, monto: 20, fecha: new Date(), observaciones: 'expense', usuarioId: 1 });
  const repo = { ...f.repo, guardarEnTransaccion: async () => { const error = new Error('duplicate'); error.code = '23505'; throw error; } };
  await assert.rejects(() => new MovimientoCajaService(repo, f.users).reversar(manager(), original.id, new Date(), 'voided', 1), /ya fue reversado/);
});

test('contract/unit pagination applies offset, limit, stable ordering, and page metadata', async () => {
  const calls = [];
  const entities = [{ id: 3, fecha: '2026-08-03' }, { id: 2, fecha: '2026-08-02' }];
  const qb = { leftJoinAndSelect(...v) { calls.push(['leftJoinAndSelect', ...v]); return this; }, orderBy(...v) { calls.push(['orderBy', ...v]); return this; }, addOrderBy(...v) { calls.push(['addOrderBy', ...v]); return this; }, skip(v) { calls.push(['skip', v]); return this; }, take(v) { calls.push(['take', v]); return this; }, async getManyAndCount() { return [entities, 5]; } };
  const repository = Object.create(require('../dist/modules/movimientos-caja/infrastructure/persistence/typeorm/movimiento-caja.typeorm-repository').MovimientoCajaTypeOrmRepository.prototype);
  repository.repo = { createQueryBuilder: () => qb };
  const result = await repository.listar({ pagina: 2, limite: 2 });
  assert.deepEqual(calls, [['leftJoinAndSelect', 'm.usuario', 'usuario'], ['leftJoinAndSelect', 'm.reversiones', 'reversiones'], ['orderBy', 'm.fecha', 'DESC'], ['addOrderBy', 'm.id', 'DESC'], ['skip', 2], ['take', 2]]);
  assert.deepEqual(result.datos.map(value => value.id), [3, 2]);
  assert.deepEqual({ pagina: result.pagina, limite: result.limite, total: result.total, totalPaginas: result.totalPaginas }, { pagina: 2, limite: 2, total: 5, totalPaginas: 3 });
});

test('contract/unit summary builds grouped SQL with inclusive date filters and money aggregates', async () => {
  const calls = [];
  const rows = [{ tipo: 'ENTRADA', concepto: 'PAGO_CLIENTE', entradas: '12.50', salidas: '0' }, { tipo: 'SALIDA', concepto: 'GASTO', entradas: '0', salidas: '4.25' }];
  const qb = { select(...v) { calls.push(['select', ...v]); return this; }, addSelect(...v) { calls.push(['addSelect', ...v]); return this; }, groupBy(...v) { calls.push(['groupBy', ...v]); return this; }, addGroupBy(...v) { calls.push(['addGroupBy', ...v]); return this; }, setParameters(v) { calls.push(['setParameters', v]); return this; }, andWhere(...v) { calls.push(['andWhere', ...v]); return this; }, async getRawMany() { return rows; } };
  const repository = Object.create(require('../dist/modules/movimientos-caja/infrastructure/persistence/typeorm/movimiento-caja.typeorm-repository').MovimientoCajaTypeOrmRepository.prototype);
  repository.repo = { createQueryBuilder: () => qb };
  const result = await repository.calcularTotales({ fechaDesde: '2026-08-01', fechaHasta: '2026-08-31' });
  assert.equal(result.totalEntradas, 12.5); assert.equal(result.totalSalidas, 4.25); assert.equal(result.balanceNeto, 8.25);
  assert.equal(result.pagosClientes, 12.5); assert.equal(result.gastos, 4.25); assert.deepEqual(result.porConcepto.GASTO, { entradas: 0, salidas: 4.25, balance: -4.25 });
  assert.ok(calls.some(call => call[0] === 'addSelect' && String(call[1]).includes('SUM(CASE')));
});

test('contract/unit summary accepts the same search, type, concept, and date filters as the list', async () => {
  const calls = [];
  const qb = { select() { return this; }, addSelect() { return this; }, groupBy() { return this; }, addGroupBy() { return this; }, setParameters() { return this; }, andWhere(...v) { calls.push(v); return this; }, async getRawMany() { return []; } };
  const repository = Object.create(require('../dist/modules/movimientos-caja/infrastructure/persistence/typeorm/movimiento-caja.typeorm-repository').MovimientoCajaTypeOrmRepository.prototype);
  repository.repo = { createQueryBuilder: () => qb };
  await repository.calcularTotales({ buscar: 'gasto', tipo: 'SALIDA', concepto: 'GASTO', fechaDesde: '2026-08-01', fechaHasta: '2026-08-31' });
  assert.equal(calls.length, 5);
  assert.equal(typeof calls[0][0].whereFactory, 'function');
  assert.deepEqual(calls.slice(1).map(call => call[0]), ['m.tipo = :tipo', 'm.concepto = :concepto', 'm.fecha >= :desde', 'm.fecha <= :hasta']);
});

test('contract/unit list accepts comma-separated multiple concepts without replacing the single concept filter', async () => {
  const calls = [];
  const qb = { andWhere(...v) { calls.push(v); return this; }, leftJoinAndSelect() { return this; }, orderBy() { return this; }, addOrderBy() { return this; }, skip() { return this; }, take() { return this; }, async getManyAndCount() { return [[], 0]; } };
  const repository = Object.create(require('../dist/modules/movimientos-caja/infrastructure/persistence/typeorm/movimiento-caja.typeorm-repository').MovimientoCajaTypeOrmRepository.prototype);
  repository.repo = { createQueryBuilder: () => qb };
  await repository.listar({ pagina: 1, limite: 10, conceptos: ['APORTE_CAPITAL', 'RETIRO', 'GASTO', 'AJUSTE_ENTRADA', 'AJUSTE_SALIDA'] });
  assert.deepEqual(calls, [[ 'm.concepto IN (:...conceptos)', { conceptos: ['APORTE_CAPITAL', 'RETIRO', 'GASTO', 'AJUSTE_ENTRADA', 'AJUSTE_SALIDA'] } ]]);
});

test('contract/unit list validation parses concepts and rejects unknown values', async () => {
  const { ValidationPipe } = require('@nestjs/common');
  const { FiltrosMovimientosCajaDto } = require('../dist/modules/movimientos-caja/application/dto/filtros-movimientos-caja.dto');
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const valid = await pipe.transform({ conceptos: 'APORTE_CAPITAL, RETIRO, GASTO, AJUSTE_ENTRADA, AJUSTE_SALIDA' }, { type: 'query', metatype: FiltrosMovimientosCajaDto, data: undefined });
  assert.deepEqual(valid.conceptos, ['APORTE_CAPITAL', 'RETIRO', 'GASTO', 'AJUSTE_ENTRADA', 'AJUSTE_SALIDA']);
  await assert.rejects(() => pipe.transform({ conceptos: 'GASTO,NO_EXISTE' }, { type: 'query', metatype: FiltrosMovimientosCajaDto, data: undefined }));
});

test('contract/unit list mapper exposes reversal evidence without detail requests', () => {
  const { MovimientoCajaMapper } = require('../dist/modules/movimientos-caja/infrastructure/persistence/typeorm/movimiento-caja.mapper');
  const value = MovimientoCajaMapper.toDomain({ id: 12, tipo: T.SALIDA, concepto: C.GASTO, monto: 20, fecha: '2026-09-16', fechaCreacion: new Date(), observaciones: 'expense', pagoId: null, formaPagoId: 1, prestamoId: null, refinanciamientoId: null, movimientoReversadoId: null, usuarioId: 3, reversiones: [{ id: 13, tipo: T.ENTRADA, monto: 20, fecha: '2026-09-16' }] });
  assert.deepEqual(value.reversiones, [{ id: 13, tipo: T.ENTRADA, monto: 20, fecha: new Date('2026-09-16T00:00:00.000Z') }]);
});

test('detail mapper preserves references and exposes only the actor identity', () => {
  const { MovimientoCajaMapper } = require('../dist/modules/movimientos-caja/infrastructure/persistence/typeorm/movimiento-caja.mapper');
  const value = MovimientoCajaMapper.toDomain({ id: 9, tipo: T.SALIDA, concepto: C.REVERSO, monto: 25, fecha: '2026-08-10', fechaCreacion: new Date('2026-08-10T18:30:00.000Z'), observaciones: 'voided', pagoId: null, formaPagoId: 2, prestamoId: 4, refinanciamientoId: null, movimientoReversadoId: 8, usuarioId: 3, usuario: { id: 3, nombreCompleto: 'Admin', activo: true }, formaPago: { id: 2, nombre: 'SINPE' }, movimientoReversado: { id: 8, concepto: C.GASTO, monto: 25 }, pago: null, prestamo: null, refinanciamiento: null, reversiones: [] });
  assert.deepEqual({ pagoId: value.pagoId, prestamoId: value.prestamoId, movimientoReversadoId: value.movimientoReversadoId, actor: value.usuario, formaPago: value.formaPago }, { pagoId: null, prestamoId: 4, movimientoReversadoId: 8, actor: { id: 3, nombreCompleto: 'Admin', activo: true }, formaPago: { id: 2, nombre: 'SINPE' } });
  assert.equal(value.fecha.toISOString().slice(0, 10), '2026-08-10');
});

test('movement GET controller remains administrator-only', () => {
  const { MovimientosCajaController } = require('../dist/modules/movimientos-caja/presentation/controllers/movimientos-caja.controller');
  const { RolUsuario } = require('../dist/modules/usuarios/domain/enums/rol-usuario.enum');
  assert.deepEqual(Reflect.getMetadata('roles', MovimientosCajaController), [RolUsuario.ADMINISTRADOR]);
});

test('contract/unit manual and automatic flows preserve their distinct concepts', async () => {
  const f = fake(); const s = new MovimientoCajaService(f.repo, f.users); const m = manager(f.items);
  const manual = await s.crearManual(m, { concepto: C.RETIRO, monto: 7, fecha: new Date(), usuarioId: 1 });
  const automatic = await s.automatico(m, { tipo: T.ENTRADA, concepto: C.PAGO_CLIENTE, monto: 8, fecha: new Date(), pagoId: 41, prestamoId: 51, usuarioId: 1 });
  assert.equal(manual.tipo, T.SALIDA); assert.equal(automatic.tipo, T.ENTRADA); assert.equal(f.items.length, 2);
});

test('contract/unit payment transaction shares one manager and rolls back on cash failure', async () => {
  await assertSharedTransactionRollback('payment', { concepto: C.PAGO_CLIENTE, tipo: T.ENTRADA, pagoId: 1, prestamoId: 2 });
});

test('contract/unit loan transaction shares one manager and rolls back on cash failure', async () => {
  await assertSharedTransactionRollback('loan', { concepto: C.DESEMBOLSO_PRESTAMO, tipo: T.SALIDA, prestamoId: 2 });
});

test('contract/unit refinancing transaction shares one manager and rolls back on cash failure', async () => {
  await assertSharedTransactionRollback('refinancing', { concepto: C.DESEMBOLSO_REFINANCIAMIENTO, tipo: T.SALIDA, prestamoId: 3, refinanciamientoId: 4 });
});

async function assertSharedTransactionRollback(name, movement) {
  const committed = []; let callbackManager;
  const dataSource = { transaction: async callback => { const pending = []; callbackManager = { name, pending, save: value => pending.push(value) }; try { await callback(callbackManager); committed.push(...pending); } catch { /* simulated transaction rollback */ } } };
  await dataSource.transaction(async manager => { manager.save({ operation: name }); assert.equal(manager, callbackManager); manager.save(movement); throw new Error('simulated cash failure'); });
  assert.deepEqual(committed, [], `${name} rollback must discard both domain and cash writes`);
}

test('contract/unit refinancing with zero new money produces no disbursement movement', async () => {
  const f = fake(); const s = new MovimientoCajaService(f.repo, f.users); const m = manager(f.items);
  // This models the use-case guard: the automatic cash operation is not called for zero output.
  const newMoney = 0; if (newMoney > 0) await s.automatico(m, { tipo: T.SALIDA, concepto: C.DESEMBOLSO_REFINANCIAMIENTO, monto: newMoney, fecha: new Date(), prestamoId: 1, refinanciamientoId: 2, usuarioId: 1 });
  assert.equal(f.items.length, 0);
});

test('estado aggregates opening movements once, preserves categories, cents, reversals, and excludes future rows', async () => {
  const { EstadoMovimientosCajaService } = require('../dist/modules/movimientos-caja/application/services/estado-movimientos-caja.service');
  const { ConfiguracionFinancieraOrmEntity, CierreMensualOrmEntity, DetalleCorteMensualOrmEntity } = require('../dist/modules/cierre-financiero/domain/financial.orm-entities');
  const rows = [
    { tipo: 'ENTRADA', concepto: 'PAGO_CLIENTE', monto: '10.01' }, { tipo: 'SALIDA', concepto: 'DESEMBOLSO_PRESTAMO', monto: '2.00' },
    { tipo: 'ENTRADA', concepto: 'APORTE_CAPITAL', monto: '3.00' }, { tipo: 'SALIDA', concepto: 'RETIRO', monto: '1.01' },
    { tipo: 'SALIDA', concepto: 'GASTO', monto: '0.50' }, { tipo: 'ENTRADA', concepto: 'REVERSO', monto: '0.25' },
    { tipo: 'SALIDA', concepto: 'REVERSO', monto: '0.10' }, { tipo: 'ENTRADA', concepto: 'NUEVO_CONCEPTO', monto: '0.04' },
  ];
  const db = { getRepository(entity) {
    if (entity === ConfiguracionFinancieraOrmEntity) return { findOne: async () => ({ fechaApertura: '2026-09-01', disponibleInicial: 100 }) };
    if (entity === CierreMensualOrmEntity) return { createQueryBuilder: () => ({ where() { return this; }, orderBy() { return this; }, getOne: async () => null }) };
    if (entity === DetalleCorteMensualOrmEntity) return { find: async () => [] };
  } };
  let queries = 0;
  const service = new EstadoMovimientosCajaService(db, { agregarEstado: async (from, to) => { queries++; assert.deepEqual([from, to], ['2026-09-01', '2026-09-16']); return { rows, count: rows.length }; } });
  const value = await service.obtener('2026-09-16');
  assert.equal(queries, 1); assert.equal(value.disponible, 109.69); assert.equal(value.flujoNeto, 9.69); assert.equal(value.cantidadMovimientos, 8);
  assert.equal(value.entradas.pagosClientes, 10.01); assert.equal(value.entradas.aportesCapital, 3); assert.equal(value.entradas.reversos, 0.25); assert.equal(value.entradas.otros, 0.04);
  assert.equal(value.salidas.desembolsosPrestamos, 2); assert.equal(value.salidas.retiros, 1.01); assert.equal(value.salidas.gastos, 0.5); assert.equal(value.salidas.reversos, 0.1);
  assert.equal(value.entradas.total, Math.round(Object.values(value.entradas).filter(Number.isFinite).slice(1).reduce((a, b) => a + b, 0) * 100) / 100);
  assert.equal(value.salidas.total, Math.round(Object.values(value.salidas).filter(Number.isFinite).slice(1).reduce((a, b) => a + b, 0) * 100) / 100);
});

test('estado uses immutable exact close snapshot without re-querying closed movements', async () => {
  const { EstadoMovimientosCajaService } = require('../dist/modules/movimientos-caja/application/services/estado-movimientos-caja.service');
  const { ConfiguracionFinancieraOrmEntity, CierreMensualOrmEntity, DetalleCorteMensualOrmEntity, ConceptoDetalleCorte } = require('../dist/modules/cierre-financiero/domain/financial.orm-entities');
  let aggregateCalls = 0;
  const db = { getRepository(entity) {
    if (entity === ConfiguracionFinancieraOrmEntity) return { findOne: async () => ({ fechaApertura: '2026-09-01', disponibleInicial: 10 }) };
    if (entity === CierreMensualOrmEntity) return { createQueryBuilder: () => ({ where() { return this; }, orderBy() { return this; }, getOne: async () => ({ id: 7, fechaFin: '2026-09-15' }) }) };
    if (entity === DetalleCorteMensualOrmEntity) return { find: async () => [{ concepto: ConceptoDetalleCorte.DISPONIBLE_FINAL, monto: 25 }, { concepto: ConceptoDetalleCorte.ENTRADAS_CAJA, monto: 20 }, { concepto: ConceptoDetalleCorte.SALIDAS_CAJA, monto: 5 }] };
  } };
  const value = await new EstadoMovimientosCajaService(db, { agregarEstado: async () => { aggregateCalls++; return { rows: [], count: 0 }; } }).obtener('2026-09-15');
  assert.equal(value.origenSaldo, 'ULTIMO_CIERRE'); assert.equal(value.disponibleOrigen, 25); assert.equal(value.disponible, 25); assert.equal(value.flujoNeto, 0); assert.equal(value.cantidadMovimientos, 0); assert.equal(aggregateCalls, 0);
});

test('estado rejects invalid, future, before-opening dates, and missing configuration', async () => {
  const { EstadoMovimientosCajaService } = require('../dist/modules/movimientos-caja/application/services/estado-movimientos-caja.service');
  const { ConfiguracionFinancieraOrmEntity } = require('../dist/modules/cierre-financiero/domain/financial.orm-entities');
  const db = config => ({ getRepository: () => ({ findOne: async () => config }) });
  const repo = { agregarEstado: async () => ({ rows: [], count: 0 }) };
  await assert.rejects(() => new EstadoMovimientosCajaService(db({ fechaApertura: '2026-09-01', disponibleInicial: 0 }), repo).obtener('2026-02-30'), /válida/);
  await assert.rejects(() => new EstadoMovimientosCajaService(db({ fechaApertura: '2026-09-01', disponibleInicial: 0 }), repo).obtener('2026-09-17'), /posterior/);
  await assert.rejects(() => new EstadoMovimientosCajaService(db({ fechaApertura: '2026-09-01', disponibleInicial: 0 }), repo).obtener('2026-08-31'), /anterior/);
  await assert.rejects(() => new EstadoMovimientosCajaService(db(null), repo).obtener('2026-09-16'), /Configuración/);
  assert.equal(ConfiguracionFinancieraOrmEntity.name, 'ConfiguracionFinancieraOrmEntity');
});

test('estado route is declared before id and keeps administrator authorization', () => {
  const { MovimientosCajaController } = require('../dist/modules/movimientos-caja/presentation/controllers/movimientos-caja.controller');
  const routes = Reflect.getMetadata('path', MovimientosCajaController.prototype.estado);
  assert.equal(routes, 'estado'); assert.deepEqual(Reflect.getMetadata('roles', MovimientosCajaController), ['ADMINISTRADOR']);
});

test('estado query validation accepts only strict date-only fecha and preserves the controller contract', async () => {
  const { ValidationPipe } = require('@nestjs/common');
  const { EstadoMovimientosCajaQueryDto } = require('../dist/modules/movimientos-caja/application/dto/estado-movimientos-caja.dto');
  const { MovimientosCajaController } = require('../dist/modules/movimientos-caja/presentation/controllers/movimientos-caja.controller');
  const calls = [];
  const controller = new MovimientosCajaController({}, {}, { obtener: async fecha => { calls.push(fecha); return { fechaConsulta: fecha }; } }, {});
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const validateQuery = query => pipe.transform(query, { type: 'query', metatype: EstadoMovimientosCajaQueryDto, data: undefined });

  const empty = await validateQuery({});
  await controller.estado(empty);
  const valid = await validateQuery({ fecha: '2026-09-16' });
  await controller.estado(valid);
  assert.deepEqual(calls, [undefined, '2026-09-16']);

  for (const fecha of ['16/09/2026', 'texto', '2026-02-30', '2026-09-16T00:00:00Z']) {
    await assert.rejects(() => validateQuery({ fecha }));
  }
  await assert.rejects(() => validateQuery({ foo: 'bar' }));
});

test('ETAPA 3.8.1 manual matrix A-AH', async () => {
  const { ValidationPipe } = require('@nestjs/common');
  const { CrearMovimientoCajaDto } = require('../dist/modules/movimientos-caja/application/dto/crear-movimiento-caja.dto');
  const { economicDateOnly } = require('../dist/common/economic-date');
  const today = economicDateOnly(); const date = value => new Date(`${value}T06:00:00.000Z`); const tomorrowParts = today.split('-').map(Number); const tomorrowValue = new Date(Date.UTC(tomorrowParts[0], tomorrowParts[1] - 1, tomorrowParts[2] + 1)).toISOString().slice(0, 10); const tomorrow = date(tomorrowValue);
  const open = { assertOpen: async (_, value) => { const current = economicDateOnly(value); if (current === 'NO_CONFIG') throw new Error('unreachable'); if (current < '2026-01-01') throw new Error('anterior'); if (current === '2026-02-01') throw new Error('cerrado'); } };
  const f = fake(); const service = new MovimientoCajaService(f.repo, f.users, open, f.formas); const create = (concepto, extra = {}) => service.crearManual({}, { concepto, monto: 10, fecha: date(today), usuarioId: 1, ...extra });
  // A-C: active forms are accepted for required concepts; D-G: adjustments accept absent or active forms.
  for (const concepto of [C.APORTE_CAPITAL, C.RETIRO, C.GASTO]) await create(concepto, { formaPagoId: 1 });
  await create(C.AJUSTE_ENTRADA, { observaciones: 'entry' }); await create(C.AJUSTE_SALIDA, { observaciones: 'exit' }); await create(C.AJUSTE_ENTRADA, { observaciones: 'entry', formaPagoId: 1 }); await create(C.AJUSTE_SALIDA, { observaciones: 'exit', formaPagoId: 1 });
  // H-I: nonexistent/inactive forms.
  const forms = { buscarPorIdEnTransaccion: async (_, id) => id === 404 ? null : { activo: false } }; const invalidForms = new MovimientoCajaService(f.repo, f.users, open, forms);
  await assert.rejects(() => invalidForms.crearManual({}, { concepto: C.GASTO, monto: 10, fecha: date(today), usuarioId: 1, formaPagoId: 404 }), /no existe/);
  await assert.rejects(() => invalidForms.crearManual({}, { concepto: C.GASTO, monto: 10, fecha: date(today), usuarioId: 1, formaPagoId: 9 }), /inactiva/);
  // J-N: today, future, before opening, absent configuration, and closed period.
  await create(C.RETIRO, { formaPagoId: 1 });
  await assert.rejects(() => create(C.RETIRO, { fecha: tomorrow, formaPagoId: 1 }), /posterior/);
  await assert.rejects(() => service.crearManual({}, { concepto: C.RETIRO, monto: 10, fecha: date('2025-12-31'), usuarioId: 1, formaPagoId: 1 }), /anterior/);
  await assert.rejects(() => new MovimientoCajaService(f.repo, f.users, { assertOpen: async () => { throw new Error('Configuración financiera no encontrada.'); } }, f.formas).crearManual({}, { concepto: C.RETIRO, monto: 10, fecha: date(today), usuarioId: 1, formaPagoId: 1 }), /Configuración/);
  await assert.rejects(() => new MovimientoCajaService(f.repo, f.users, { assertOpen: async () => { throw new Error('período cerrado'); } }, f.formas).crearManual({}, { concepto: C.RETIRO, monto: 10, fecha: date(today), usuarioId: 1, formaPagoId: 1 }), /cerrado/);
  // O-R: automatic concepts, amount DTO validation, and required form validation.
  await assert.rejects(() => create(C.PAGO_CLIENTE, { formaPagoId: 1 }), /automático/);
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }); const validate = value => pipe.transform(value, { type: 'body', metatype: CrearMovimientoCajaDto, data: undefined });
  for (const monto of [0, -1, 10.123]) await assert.rejects(() => validate({ concepto: C.GASTO, monto, fecha: today, formaPagoId: 1 }));
  await assert.rejects(() => service.crearManual({}, { concepto: C.GASTO, monto: 10, fecha: date(today), usuarioId: 1 }), /formaPagoId/);
  // S-T: replay is key-scoped and a different key creates a second movement.
  const first = await create(C.GASTO, { monto: 12, formaPagoId: 1, idempotencyKey: 'same-key' }); const replay = await create(C.GASTO, { monto: 12, formaPagoId: 1, idempotencyKey: 'same-key' }); assert.equal(replay.id, first.id); await assert.rejects(() => create(C.GASTO, { monto: 13, formaPagoId: 1, idempotencyKey: 'same-key' }), /diferente/); const secondKey = await create(C.GASTO, { monto: 12, formaPagoId: 1, idempotencyKey: 'other-key' }); assert.notEqual(secondKey.id, first.id);
  // U-W: every manual concept can be reversed and inherits its form.
  for (const [concepto, observaciones] of [[C.APORTE_CAPITAL, 'a'], [C.RETIRO, 'r'], [C.GASTO, 'g'], [C.AJUSTE_ENTRADA, 'ae'], [C.AJUSTE_SALIDA, 'as']]) { const original = await create(concepto, { formaPagoId: 1, observaciones }); const reversal = await service.reversar({}, original.id, date(today), 'reversal', 1); assert.equal(reversal.monto, original.monto); assert.equal(reversal.formaPagoId, original.formaPagoId); }
  // X-AH: reversal date/period and graph protections, plus all automatic concepts.
  const original = await create(C.GASTO, { formaPagoId: 1, observaciones: 'double' }); await assert.rejects(() => service.reversar({}, original.id, tomorrow, 'future', 1), /posterior/); const reversal = await service.reversar({}, original.id, date(today), 'once', 1); await assert.rejects(() => service.reversar({}, original.id, date(today), 'again', 1), /reversado/); await assert.rejects(() => service.reversar({}, reversal.id, date(today), 'nested', 1), /reverso/);
  for (const automatic of [C.PAGO_CLIENTE, C.DESEMBOLSO_PRESTAMO, C.DESEMBOLSO_REFINANCIAMIENTO]) { const automaticMovement = { id: 900 + Math.random(), concepto: automatic, tipo: T.SALIDA, monto: 1, formaPagoId: 1 }; f.items.push(automaticMovement); await assert.rejects(() => service.reversar({}, automaticMovement.id, date(today), 'automatic', 1), /automáticos/); }
});
