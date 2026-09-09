const test = require('node:test');
const assert = require('node:assert/strict');
const { ValidationPipe } = require('@nestjs/common');
const { FiltrosPrestamosDto } = require('../dist/modules/prestamos/application/dto/filtros-prestamos.dto');
const { ListarPrestamosUseCase } = require('../dist/modules/prestamos/application/use-cases/listar-prestamos.use-case');

const indicators = ['AL_DIA', 'ATRASADO', 'PLAZO_CUMPLIDO', 'SALDADO'];
const filters = { pagina: 2, limite: 1, estados: ['ACTIVO', 'INCOBRABLE'], buscar: 'Ana' };

function setup(indicatorById) {
  const calls = [];
  const candidates = [1, 2, 3, 4].map((id) => ({ id }));
  const repository = {
    async listarParaIndicador(value) { calls.push(['candidates', value]); return candidates; },
    async listar(value) {
      calls.push(['list', value]);
      const ids = value.candidateIds;
      return ids ? { datos: ids.slice((value.pagina - 1) * value.limite, value.pagina * value.limite).map((id) => ({ id })), pagina: value.pagina, limite: value.limite, total: ids.length, totalPaginas: Math.ceil(ids.length / value.limite) } : { datos: [], pagina: value.pagina, limite: value.limite, total: 0, totalPaginas: 0 };
    },
  };
  let bulkCalls = 0;
  const cobranza = { async calcular(value) { bulkCalls++; assert.strictEqual(value, candidates); return new Map(candidates.map(({ id }) => [id, { indicadorCobranza: indicatorById[id] }])); } };
  return { useCase: new ListarPrestamosUseCase(repository, cobranza), calls, get bulkCalls() { return bulkCalls; } };
}

for (const indicator of indicators) test(`filters server-side by ${indicator} before pagination`, async () => {
  const otherIndicators = indicators.filter((value) => value !== indicator);
  const setupValue = setup({ 1: indicator, 2: otherIndicators[0], 3: otherIndicators[1], 4: otherIndicators[2] });
  const result = await setupValue.useCase.execute({ ...filters, pagina: 1, indicadorCobranza: indicator });
  assert.deepEqual(result, { datos: [{ id: 1 }], pagina: 1, limite: 1, total: 1, totalPaginas: 1 });
  assert.equal(setupValue.bulkCalls, 1);
  assert.deepEqual(setupValue.calls[1][1].candidateIds, [1]);
  assert.deepEqual(setupValue.calls[1][1].estados, filters.estados);
});

test('empty indicator matches return zero totals', async () => {
  const setupValue = setup({ 1: 'ATRASADO', 2: 'ATRASADO', 3: 'PLAZO_CUMPLIDO', 4: 'SALDADO' });
  const result = await setupValue.useCase.execute({ ...filters, indicadorCobranza: 'AL_DIA' });
  assert.equal(result.total, 0);
  assert.equal(result.totalPaginas, 0);
});

test('filtered totals and pages represent the full filtered set with limit one', async () => {
  const setupValue = setup({ 1: 'AL_DIA', 2: 'AL_DIA', 3: 'ATRASADO', 4: 'SALDADO' });
  const result = await setupValue.useCase.execute({ ...filters, pagina: 1, limite: 1, indicadorCobranza: 'AL_DIA' });
  assert.deepEqual(result.datos, [{ id: 1 }]);
  assert.equal(result.total, 2);
  assert.equal(result.totalPaginas, 2);
});

test('no indicator preserves the existing single repository path', async () => {
  const setupValue = setup({});
  await setupValue.useCase.execute(filters);
  assert.deepEqual(setupValue.calls.map(([kind]) => kind), ['list']);
  assert.equal(setupValue.bulkCalls, 0);
});

for (const direction of ['ASC', 'DESC']) test(`indicator sorting is calculated for all candidates before pagination (${direction})`, async () => {
  const setupValue = setup({ 1: 'SALDADO', 2: 'AL_DIA', 3: 'SALDADO', 4: 'ATRASADO' });
  await setupValue.useCase.execute({ ...filters, ordenarPor: 'indicadorCobranza', direccionOrden: direction });
  const ids = setupValue.calls[1][1].candidateIds;
  assert.deepEqual(ids, direction === 'ASC' ? [2, 4, 1, 3] : [3, 1, 4, 2]);
  assert.equal(setupValue.calls[1][1].pagina, filters.pagina);
  assert.equal(setupValue.calls[1][1].limite, filters.limite);
});

test('invalid indicator values are rejected by the DTO whitelist', async () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  await assert.rejects(() => pipe.transform({ indicadorCobranza: 'UNKNOWN' }, { type: 'query', metatype: FiltrosPrestamosDto }));
});
