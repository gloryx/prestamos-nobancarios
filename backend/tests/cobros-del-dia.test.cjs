const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { BadRequestException } = require('@nestjs/common');
const { ConsultarCobrosDelDiaUseCase } = require('../dist/modules/pagos/application/use-cases/consultar-cobros-del-dia.use-case');
const { CobrosDelDiaTypeOrmRepository } = require('../dist/modules/pagos/infrastructure/persistence/typeorm/cobros-del-dia.typeorm-repository');

const source = fs.readFileSync(path.join(__dirname, '../src/modules/pagos/infrastructure/persistence/typeorm/cobros-del-dia.typeorm-repository.ts'), 'utf8');
const controllerSource = fs.readFileSync(path.join(__dirname, '../src/modules/pagos/presentation/controllers/pagos.controller.ts'), 'utf8');
const rows = [{ estado: 'PAGADO', montoProgramado: 100, montoPagado: 60 }, { estado: 'PENDIENTE', montoProgramado: 200, montoPagado: 0 }];
const useCase = (data = rows) => new ConsultarCobrosDelDiaUseCase({ consultar: async (query) => { useCase.query = query; return data; } });
const rejects = async (query) => assert.rejects(() => useCase().execute(query), BadRequestException);

test('accepts a single date', async () => { const result = await useCase().execute({ fecha: '2026-09-15' }); assert.equal(result.fecha, '2026-09-15'); });
test('accepts a complete range', async () => { const result = await useCase().execute({ fechaDesde: '2026-09-15', fechaHasta: '2026-09-30' }); assert.equal(result.fechaHasta, '2026-09-30'); });
test('passes inclusive range bounds unchanged', async () => { const repo = { consultar: async (query) => { assert.deepEqual(query, { fechaDesde: '2026-09-15', fechaHasta: '2026-09-30' }); return []; } }; await new ConsultarCobrosDelDiaUseCase(repo).execute({ fechaDesde: '2026-09-15', fechaHasta: '2026-09-30' }); });
test('rejects an empty filter', () => rejects({}));
test('rejects a range with only fechaDesde', () => rejects({ fechaDesde: '2026-09-15' }));
test('rejects a range with only fechaHasta', () => rejects({ fechaHasta: '2026-09-15' }));
test('rejects mixing fecha with range filters', () => rejects({ fecha: '2026-09-15', fechaDesde: '2026-09-15', fechaHasta: '2026-09-20' }));
test('rejects a reversed range', () => rejects({ fechaDesde: '2026-09-30', fechaHasta: '2026-09-15' }));
test('rejects non date-only input', () => rejects({ fecha: '2026-09-15T00:00:00Z' }));
test('rejects impossible calendar dates', () => rejects({ fecha: '2026-02-30' }));
test('uses date-only SQL parameters without Date conversion', () => { assert.match(source, /plan\.fecha_vencimiento = :date/); assert.match(source, /BETWEEN :from AND :to/); assert.doesNotMatch(source, /new Date/); });
test('uses the real user full-name column for collectors', () => { assert.match(source, /u\.nombre_completo AS cobrador_nombre/); assert.doesNotMatch(source, /u\.primer_nombre|u\.segundo_nombre|u\.primer_apellido|u\.segundo_apellido/); });
test('filters only active loans', () => assert.match(source, /prestamo\.estado = :active/));
test('excludes cancelled, refinanced, uncollectible and annulled loans by active allow-list', () => { assert.match(source, /active: 'ACTIVO'/); assert.doesNotMatch(source, /estado IN.*CANCELADO/); });
test('excludes annulled payments from installment sums', () => assert.match(source, /p\.estado = 'REGISTRADO'/));
test('sums multiple registered payments by plan', () => { assert.match(source, /SUM\(p\.monto\)/); assert.match(source, /GROUP BY p\.plan_pago_id/); });
test('uses the explicit plan-payment foreign key', () => assert.match(source, /p\.plan_pago_id/));
test('does not issue per-row ORM reads', () => { assert.doesNotMatch(source, /\.findOne\(|\.getOne\(|\.find\(/); assert.equal((source.match(/getRawMany\(\)/g) || []).length, 1); });
test('orders by date, client, loan and installment', () => { assert.match(source, /orderBy\('plan\.fecha_vencimiento', 'ASC'\)/); assert.match(source, /addOrderBy\('nombreCompleto', 'ASC'\)/); assert.match(source, /addOrderBy\('prestamo\.id', 'ASC'\)/); assert.match(source, /addOrderBy\('plan\.numero_pago', 'ASC'\)/); });
test('returns one row per plan installment', () => assert.match(source, /select\('plan\.id', 'planPagoId'\)/));
test('derives PAGADO and PENDIENTE from registered plan sum', () => assert.match(source, /CASE WHEN COALESCE\(pago_plan\.monto_pagado, 0\) > 0 THEN 'PAGADO' ELSE 'PENDIENTE'/));
test('uses the installment date, not the payment date, for daily collections', async () => {
  const installment = { id: 31, fecha: '2026-09-15' };
  const registeredPayment = { planPagoId: installment.id, fecha: '2026-09-17', monto: 100 };
  const queryBuilder = {
    conditions: [],
    innerJoin() { return this; }, leftJoin() { return this; }, select() { return this; }, addSelect() { return this; },
    where(_sql, params) { this.conditions.push(params); return this; },
    andWhere(_sql, params) { this.conditions.push(params); return this; },
    orderBy() { return this; }, addOrderBy() { return this; },
    async getRawMany() {
      const date = this.conditions.at(-1).date;
      if (date !== installment.fecha) return [];
      return [{ planPagoId: installment.id, numeroPago: 1, fecha: installment.fecha, montoProgramado: '100', montoPagado: String(registeredPayment.monto), estado: 'PAGADO', prestamoId: 1, capital: '100', saldoActual: '0', clienteId: 1, formaPagoId: 1, cobradorId: null }];
    },
  };
  const repository = new CobrosDelDiaTypeOrmRepository({ createQueryBuilder: () => queryBuilder });
  const paidOn15 = await repository.consultar({ fecha: '2026-09-15' });
  const absentOn17 = await repository.consultar({ fecha: '2026-09-17' });
  assert.equal(paidOn15[0].estado, 'PAGADO');
  assert.equal(paidOn15[0].fecha, '2026-09-15');
  assert.deepEqual(absentOn17, []);
});
test('reuses current loan balance rule', () => assert.match(source, /prestamo\.monto_total - COALESCE\(pago_prestamo\.total_pagado, 0\)/));
test('totals use exactly returned rows', async () => { const result = await useCase().execute({ fecha: '2026-09-15' }); assert.deepEqual(result.totales, { cantidadProgramados: 2, cantidadPagados: 1, cantidadPendientes: 1, montoProgramado: 300, montoRecibido: 60 }); });
test('keeps the existing Pagos roles', () => assert.match(controllerSource, /@Roles\(RolUsuario\.ADMINISTRADOR, RolUsuario\.VENDEDOR\)/));
