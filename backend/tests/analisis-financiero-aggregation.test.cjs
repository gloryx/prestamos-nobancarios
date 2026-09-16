const test = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { aggregateAnalisisFinanciero, aggregateComparativoFinanciero } = require('../dist/modules/analisis-financiero/application/analisis-financiero-aggregation');
const { AnalisisFinancieroUseCase } = require('../dist/modules/analisis-financiero/application/analisis-financiero.use-case');
const { AnalisisFinancieroController } = require('../dist/modules/analisis-financiero/presentation/analisis-financiero.controller');
const { RolesGuard } = require('../dist/modules/auth/roles.guard');
const { RolUsuario } = require('../dist/modules/usuarios/domain/enums/rol-usuario.enum');
const { BadRequestException } = require('@nestjs/common');

test('returns twelve months, zero empty months, totals and registered interest', () => {
  const rows = aggregateAnalisisFinanciero(2026, [{ periodo: '2026-01', monto: '150.00', interesAplicado: '50.00' }, { periodo: '2026-01', monto: '10.00', interesAplicado: '3.00' }], [{ periodo: '2026-01', monto: '100.00' }]);
  assert.equal(rows.length, 12); assert.equal(rows[0].nombreMes, 'ENERO'); assert.equal(rows[1].pagos, 0); assert.equal(rows[0].pagos, 160); assert.equal(rows[0].ganancia, 53); assert.equal(rows[0].diferencia, 60);
});

test('returns monthly totals as the exact sum of all twelve months', async () => {
  const useCase = new AnalisisFinancieroUseCase({
    pagos: async () => [{ periodo: '2026-01', monto: '150.01', interesAplicado: '50.01' }, { periodo: '2026-02', monto: '10.02', interesAplicado: '3.02' }],
    prestamos: async () => [{ periodo: '2026-01', monto: '100.01' }, { periodo: '2026-02', monto: '5.02' }],
  });
  const result = await useCase.resumenMensual(2026);
  assert.deepEqual(result.totales, { prestamos: 105.03, pagos: 160.03, diferencia: 55, ganancia: 53.03 });
  assert.equal(result.totales.prestamos, result.meses.reduce((sum, month) => sum + month.prestamos, 0));
  assert.equal(result.totales.pagos, result.meses.reduce((sum, month) => sum + month.pagos, 0));
  assert.equal(result.totales.ganancia, result.meses.reduce((sum, month) => sum + month.ganancia, 0));
  assert.equal(result.totales.diferencia, result.totales.pagos - result.totales.prestamos);
});

test('keeps empty years and validates order and twenty-year limit', async () => {
  assert.deepEqual(aggregateComparativoFinanciero(2026, 2028, [], []).map((row) => row.anio), [2026, 2027, 2028]);
  const useCase = new AnalisisFinancieroUseCase({ pagos: async () => [], prestamos: async () => [] });
  await assert.rejects(() => useCase.comparativoAnual(2027, 2026), (error) => error instanceof BadRequestException);
  await assert.rejects(() => useCase.comparativoAnual(2020, 2040), (error) => error instanceof BadRequestException);
});

test('uses real Caja movements: transferred capital is not new money and only new disbursement is added', () => {
  const originalCajaDisbursement = { periodo: '2026-01', monto: 1000 };
  const refinancingWithoutNewMoneyCaja = [];
  const refinancingWithNewMoneyCaja = [{ periodo: '2026-02', monto: 250 }];
  const withoutNewMoney = aggregateAnalisisFinanciero(2026, [], [originalCajaDisbursement, ...refinancingWithoutNewMoneyCaja]);
  const withNewMoney = aggregateAnalisisFinanciero(2026, [], [originalCajaDisbursement, ...refinancingWithNewMoneyCaja]);
  assert.equal(withoutNewMoney[0].prestamos, 1000);
  assert.equal(withoutNewMoney[1].prestamos, 0);
  assert.equal(withNewMoney[0].prestamos, 1000);
  assert.equal(withNewMoney[1].prestamos, 250);
});

test('protects both endpoints with administrator role and rejects vendor and unauthenticated requests', () => {
  for (const method of ['resumenMensual', 'comparativoAnual']) {
    const roles = Reflect.getMetadata('roles', AnalisisFinancieroController);
    assert.deepEqual(roles, [RolUsuario.ADMINISTRADOR]);
    const guard = new RolesGuard({ getAllAndOverride: () => roles });
    const context = (rol) => ({ getHandler: () => AnalisisFinancieroController.prototype[method], getClass: () => AnalisisFinancieroController, switchToHttp: () => ({ getRequest: () => ({ user: rol === undefined ? undefined : { rol } }) }) });
    assert.equal(guard.canActivate(context(RolUsuario.ADMINISTRADOR)), true);
    assert.throws(() => guard.canActivate(context(RolUsuario.VENDEDOR)), /permisos/);
    assert.throws(() => guard.canActivate(context(undefined)), /permisos/);
  }
});
