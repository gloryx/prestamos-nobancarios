const test = require('node:test');
const assert = require('node:assert/strict');
const { PrestamoTypeOrmRepository } = require('../dist/modules/prestamos/infrastructure/persistence/typeorm/prestamo.typeorm-repository');
const { PrestamosController } = require('../dist/modules/prestamos/presentation/controllers/prestamos.controller');

function loan(id, capital) {
  return {
    id,
    clienteId: id,
    periodicidadPagoId: 1,
    formaPagoId: 1,
    formaDesembolsoId: null,
    fechaAlta: '2026-01-01',
    capital,
    interes: 10,
    montoTotal: capital + 10,
    montoDesembolsado: capital,
    cantidadPagos: 1,
    planPersonalizado: false,
    estado: 'ACTIVO',
    observaciones: null,
    fechaCreacion: new Date(),
    fechaActualizacion: new Date(),
    cliente: { id, primerNombre: 'Client', segundoNombre: null, primerApellido: String(id), segundoApellido: null, identificacion: String(id), direccion: 'Address' },
    periodicidadPago: { id: 1, nombre: 'Monthly' },
    formaPago: { id: 1, nombre: 'Cash' },
    formaDesembolso: null,
  };
}

function setup(entities, totals) {
  const calls = [];
  const listQuery = {
    where() { return this; }, andWhere() { return this; }, leftJoinAndSelect() { return this; },
    orderBy() { calls.push('orderBy'); return this; }, addOrderBy() { return this; },
    skip(value) { calls.push(['skip', value]); return this; }, take(value) { calls.push(['take', value]); return this; },
    async getManyAndCount() { return [entities, entities.length]; },
  };
  const aggregateQuery = {
    select(...args) { calls.push(['select', ...args]); return this; }, addSelect(...args) { calls.push(['addSelect', ...args]); return this; },
    from(...args) { calls.push(['from', ...args]); return this; }, where(...args) { calls.push(['where', ...args]); return this; }, andWhere(...args) { calls.push(['andWhere', ...args]); return this; },
    groupBy(...args) { calls.push(['groupBy', ...args]); return this; }, async getRawMany() { return totals; },
  };
  const repository = Object.create(PrestamoTypeOrmRepository.prototype);
  repository.repository = { createQueryBuilder: () => listQuery, manager: { createQueryBuilder: () => aggregateQuery } };
  return { repository, calls };
}

test('capital pending is zero without payments and uses one bulk aggregation for multiple loans', async () => {
  const { repository, calls } = setup([loan(1, 100), loan(2, 200)], [{ prestamo_id: '2', capital_pagado: '250', total_pagado: '250' }]);
  const result = await repository.listar({ pagina: 2, limite: 2, buscar: 'client', direccion: 'address', estado: 'ACTIVO' });
  assert.deepEqual(result.datos.map(({ id, capitalPendiente, saldoPendiente }) => ({ id, capitalPendiente, saldoPendiente })), [{ id: 1, capitalPendiente: 100, saldoPendiente: 110 }, { id: 2, capitalPendiente: 0, saldoPendiente: 0 }]);
  assert.equal(calls.filter((call) => Array.isArray(call) && call[0] === 'select').length, 1);
  assert.deepEqual(calls.find((call) => Array.isArray(call) && call[0] === 'where' && String(call[1]).includes('IN')), ['where', 'pago.prestamo_id IN (:...ids)', { ids: [1, 2] }]);
  assert.deepEqual(calls.filter((call) => Array.isArray(call) && ['skip', 'take'].includes(call[0])), [['skip', 2], ['take', 2]]);
});

test('saldo pending handles no payments, partial payment, full payment, and overpayment without becoming negative', async () => {
  const { repository } = setup([loan(1, 100), loan(2, 100), loan(3, 100), loan(4, 100)], [
    { prestamo_id: '2', capital_pagado: '25', total_pagado: '50' },
    { prestamo_id: '3', capital_pagado: '110', total_pagado: '110' },
    { prestamo_id: '4', capital_pagado: '150', total_pagado: '150' },
  ]);
  const result = await repository.listar({ pagina: 1, limite: 4 });
  assert.deepEqual(result.datos.map(({ id, saldoPendiente }) => ({ id, saldoPendiente })), [
    { id: 1, saldoPendiente: 110 }, { id: 2, saldoPendiente: 60 }, { id: 3, saldoPendiente: 0 }, { id: 4, saldoPendiente: 0 },
  ]);
});

test('GET /prestamos includes saldoPendiente in each listed response', async () => {
  const listed = loan(1, 100);
  Object.assign(listed, { fechaAlta: new Date('2026-01-01T00:00:00.000Z'), capitalPendiente: 80, saldoPendiente: 90 });
  const controller = Object.create(PrestamosController.prototype);
  controller.listarUseCase = { execute: async () => ({ datos: [listed], pagina: 1, limite: 10, total: 1, totalPaginas: 1 }) };
  controller.cobranza = { calcular: async () => new Map([[1, { fechaLimiteContractual: '2027-01-01', indicadorCobranza: 'AL_DIA' }]]) };
  const result = await controller.listar({ pagina: 1, limite: 10 });
  assert.equal(result.datos[0].saldoPendiente, 90);
  assert.equal(result.datos[0].capitalPendiente, 80);
});

test('empty filtered page does not execute a payment aggregation', async () => {
  const { repository, calls } = setup([], []);
  const result = await repository.listar({ pagina: 1, limite: 10, estado: 'ACTIVO' });
  assert.deepEqual(result.datos, []);
  assert.equal(calls.some((call) => Array.isArray(call) && call[0] === 'from' && call[1] === 'pago'), false);
});
