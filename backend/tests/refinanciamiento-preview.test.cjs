const assert = require('node:assert/strict');
const test = require('node:test');

const { EstadoPrestamo } = require('../dist/modules/prestamos/domain/enums/estado-prestamo.enum');
const { calcularElegibilidadRefinanciamiento } = require('../dist/modules/refinanciamientos/application/services/calcular-elegibilidad-refinanciamiento');
const { PrevisualizarRefinanciamientoUseCase } = require('../dist/modules/refinanciamientos/application/use-cases/previsualizar-refinanciamiento.use-case');

const calculate = (totalPagado, estado = EstadoPrestamo.ACTIVO) => calcularElegibilidadRefinanciamiento({ estado, capital: 100000, interes: 20000, totalPagado });

test('preview calculation covers no payment, partial, exact and excess payment', () => {
  assert.equal(calculate(0).elegible, false);
  assert.equal(calculate(0).interesPendienteParaRefinanciar, 20000);
  assert.equal(calculate(10000).interesPendienteParaRefinanciar, 10000);
  assert.equal(calculate(20000).elegible, true);
  assert.equal(calculate(20000).capitalAmortizadoRefinanciamiento, 0);
  assert.equal(calculate(30000).capitalAmortizadoRefinanciamiento, 10000);
  assert.equal(calculate(30000).capitalPendienteRefinanciable, 90000);
  assert.equal(calculate(120000).elegible, false);
  assert.match(calculate(120000).motivo, /saldo pendiente/);
});

for (const estado of [EstadoPrestamo.REFINANCIADO, EstadoPrestamo.CANCELADO, EstadoPrestamo.INCOBRABLE]) {
  test(`preview rejects ${estado} with a clear reason`, () => {
    const result = calculate(20000, estado);
    assert.equal(result.elegible, false);
    assert.match(result.motivo, new RegExp(estado));
  });
}

test('preview reads only and returns the complete typed payload', async () => {
  let writes = 0;
  const loan = {
    id: 7, clienteId: 3, estado: EstadoPrestamo.ACTIVO, fechaAlta: '2026-08-30',
    capital: 100000, interes: 20000, montoTotal: 120000,
    cliente: { id: 3, identificacion: '1-1111-1111', primerNombre: 'Ana', segundoNombre: null, primerApellido: 'Pérez', segundoApellido: null },
  };
  const loanBuilder = { leftJoinAndSelect() { return this; }, where() { return this; }, async getOne() { return loan; } };
  const totalBuilder = { select() { return this; }, where() { return this; }, andWhere() { return this; }, async getRawOne() { return { totalPagado: '30000' }; } };
  const dataSource = {
    getRepository(entity) {
      if (entity.name === 'PrestamoOrmEntity') return { createQueryBuilder: () => loanBuilder, save: async () => { writes += 1; } };
      return { createQueryBuilder: () => totalBuilder, save: async () => { writes += 1; } };
    },
  };
  const result = await new PrevisualizarRefinanciamientoUseCase(dataSource).execute(7);
  assert.equal(result.elegible, true);
  assert.equal(result.capitalPendienteRefinanciable, 90000);
  assert.equal(result.cliente.nombreCompleto, 'Ana Pérez');
  assert.equal(writes, 0);
});

test('preview returns 404 for an unknown loan', async () => {
  const builder = { leftJoinAndSelect() { return this; }, where() { return this; }, async getOne() { return null; } };
  const dataSource = { getRepository: () => ({ createQueryBuilder: () => builder }) };
  await assert.rejects(() => new PrevisualizarRefinanciamientoUseCase(dataSource).execute(999), error => error.getStatus() === 404);
});
