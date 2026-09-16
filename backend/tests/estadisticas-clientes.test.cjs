const test = require('node:test');
const assert = require('node:assert/strict');
const { EstadisticasClientesUseCase } = require('../dist/modules/reportes/application/estadisticas-clientes.use-case');

const rows = [
  { clienteId: 2, cliente: 'Beta', identificacion: '2', cantidadPrestamos: 2, totalPrestado: 100, gananciaCobrada: 30, antiguedad: '2 años 0 meses' },
  { clienteId: 1, cliente: 'Alpha', identificacion: '1', cantidadPrestamos: 2, totalPrestado: 50, gananciaCobrada: 30, antiguedad: '0 años 1 mes' },
  { clienteId: 3, cliente: 'Gamma', identificacion: '3', cantidadPrestamos: 0, totalPrestado: 0, gananciaCobrada: 0, antiguedad: '0 años 0 meses' },
];

function execute(query) {
  return new EstadisticasClientesUseCase({ listar: async () => rows.map((row) => ({ ...row })) }).execute(query);
}

test('ordena por cada métrica y desempata por clienteId', async () => {
  assert.deepEqual((await execute({ orden: 'cantidadPrestamos', top: '10' })).datos.map((row) => row.clienteId), [1, 2, 3]);
  assert.deepEqual((await execute({ orden: 'totalPrestado', top: '10' })).datos.map((row) => row.clienteId), [2, 1, 3]);
  assert.deepEqual((await execute({ orden: 'gananciaCobrada', top: '10' })).datos.map((row) => row.clienteId), [1, 2, 3]);
});

test('aplica top y top todos sin perder clientes sin préstamos', async () => {
  assert.equal((await execute({ orden: 'totalPrestado', top: '10' })).datos.length, 3);
  assert.deepEqual((await execute({ orden: 'cantidadPrestamos', top: '20' })).datos.length, 3);
  assert.deepEqual((await execute({ orden: 'cantidadPrestamos', top: 'todos' })).datos.map((row) => row.posicion), [1, 2, 3]);
});
