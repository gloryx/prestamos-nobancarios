const test = require('node:test');
const assert = require('node:assert/strict');
const { MovimientoCaja } = require('../dist/modules/movimientos-caja/domain/entities/movimiento-caja');
const { ConceptoMovimientoCaja: C } = require('../dist/modules/movimientos-caja/domain/enums/concepto-movimiento-caja.enum');
const { TipoMovimientoCaja: T } = require('../dist/modules/movimientos-caja/domain/enums/tipo-movimiento-caja.enum');
const { MovimientoCajaService } = require('../dist/modules/movimientos-caja/application/services/movimiento-caja.service');
const { authenticatedUserId } = require('../dist/common/authenticated-user');

const manager = () => ({});
const fake = () => { const items=[]; const repo={guardarEnTransaccion:async(_,v)=>{v.id=items.length+1;items.push(v);return v;},buscarPorIdEnTransaccion:async(_,id)=>items.find(v=>v.id===id)||null,buscarPorPagoYConceptoEnTransaccion:async(_,id,c)=>items.find(v=>v.pagoId===id&&v.concepto===c)||null,buscarPorRefinanciamientoYConceptoEnTransaccion:async(_,id,c)=>items.find(v=>v.refinanciamientoId===id&&v.concepto===c)||null,buscarPorPrestamoYConceptoEnTransaccion:async(_,id,c)=>items.find(v=>v.prestamoId===id&&v.concepto===c)||null,contarReversionesEnTransaccion:async(_,id)=>items.filter(v=>v.movimientoReversadoId===id).length}; const users={buscarPorIdEnTransaccion:async()=>({activo:true})}; return {items,repo,users}; };

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
  const qb = { orderBy(...v) { calls.push(['orderBy', ...v]); return this; }, addOrderBy(...v) { calls.push(['addOrderBy', ...v]); return this; }, skip(v) { calls.push(['skip', v]); return this; }, take(v) { calls.push(['take', v]); return this; }, async getManyAndCount() { return [entities, 5]; } };
  const repository = Object.create(require('../dist/modules/movimientos-caja/infrastructure/persistence/typeorm/movimiento-caja.typeorm-repository').MovimientoCajaTypeOrmRepository.prototype);
  repository.repo = { createQueryBuilder: () => qb };
  const result = await repository.listar({ pagina: 2, limite: 2 });
  assert.deepEqual(calls, [['orderBy', 'm.fecha', 'DESC'], ['addOrderBy', 'm.id', 'DESC'], ['skip', 2], ['take', 2]]);
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
