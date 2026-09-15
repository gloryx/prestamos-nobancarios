const assert = require('node:assert/strict');
const test = require('node:test');

const { ListarPrestamosElegiblesUseCase } = require('../dist/modules/refinanciamientos/application/use-cases/listar-prestamos-elegibles.use-case');
const { PrestamoOrmEntity } = require('../dist/modules/prestamos/infrastructure/persistence/typeorm/prestamo.orm-entity');
const { PagoOrmEntity } = require('../dist/modules/pagos/infrastructure/persistence/typeorm/pago.orm-entity');

function dataSource({ loan, totalPaid = '0' } = {}) {
  const calls = [];
  const builder = {
    leftJoinAndSelect() { return this; },
    where(value) { calls.push(['where', value]); return this; },
    andWhere(value) { calls.push(['andWhere', value]); return this; },
    orderBy(value) { calls.push(['orderBy', value]); return this; },
    clone() { return this; },
    skip(value) { calls.push(['skip', value]); return this; },
    take(value) { calls.push(['take', value]); return this; },
    async getCount() { calls.push(['count']); return 1; },
    async getMany() { calls.push(['many']); return loan ? [loan] : []; },
  };
  const payments = {
    select() { return this; }, addSelect() { return this; }, where(value) { calls.push(['paymentWhere', value]); return this; },
    andWhere(value) { calls.push(['paymentAndWhere', value]); return this; }, groupBy() { return this; },
    async getRawMany() { return [{ prestamo_id: String(loan?.id ?? 1), total_pagado: totalPaid }]; },
  };
  return {
    calls,
    getRepository(entity) { return { createQueryBuilder: () => entity === PagoOrmEntity ? payments : builder }; },
  };
}

const loan = {
  id: 42, clienteId: 7, estado: 'ACTIVO', capital: 100000, interes: 20000, montoTotal: 120000,
  cliente: { id: 7, identificacion: '1-2345-6789', primerNombre: 'Ana', segundoNombre: null, primerApellido: 'Pérez', segundoApellido: 'Mora', telefono1: '8888-1111', telefono2: '8888-2222', direccion: 'San José' },
};

for (const term of ['42', 'Ana Pérez', '1-2345-6789', '8888-1111', '8888-2222', 'San José']) {
  test(`eligible search includes the server-side term: ${term}`, async () => {
    const db = dataSource({ loan, totalPaid: '20000' });
    await new ListarPrestamosElegiblesUseCase(db).execute({ pagina: 1, limite: 10, buscar: term });
    const searchClause = db.calls.find(([kind, value]) => kind === 'andWhere' && String(value).includes('buscarElegible'))?.[1];
    assert.match(String(searchClause), /CAST\(prestamo\.id AS TEXT\)/);
    assert.match(String(searchClause), /cliente\.identificacion/);
    assert.match(String(searchClause), /cliente\.telefono1/);
    assert.match(String(searchClause), /cliente\.telefono2/);
    assert.match(String(searchClause), /cliente\.direccion/);
  });
}

test('eligibility filters before count and pagination and excludes used origins', async () => {
  const db = dataSource({ loan, totalPaid: '20000' });
  const result = await new ListarPrestamosElegiblesUseCase(db).execute({ pagina: 2, limite: 1 });
  const countIndex = db.calls.findIndex(([kind]) => kind === 'count');
  const skipIndex = db.calls.findIndex(([kind]) => kind === 'skip');
  assert.ok(countIndex >= 0 && countIndex < skipIndex);
  assert.equal(result.datos[0].id, 42);
  assert.equal(result.datos[0].capitalPendiente, 100000);
  assert.equal(result.datos[0].saldoFinanciero, 100000);
  const clauses = db.calls.filter(([kind]) => kind === 'where' || kind === 'andWhere').map(([, value]) => String(value)).join('\n');
  assert.match(clauses, /prestamo\.estado/);
  assert.match(clauses, /prestamo\.interes/);
  assert.match(clauses, /prestamo\.capital/);
  assert.match(clauses, /NOT EXISTS.*prestamo_origen_id/);
  assert.match(db.calls.find(([kind]) => kind === 'paymentAndWhere')[1], /REGISTRADO/);
});

test('annulled payments do not enter the authoritative balance aggregate', async () => {
  const db = dataSource({ loan, totalPaid: '20000' });
  await new ListarPrestamosElegiblesUseCase(db).execute({ pagina: 1, limite: 10 });
  assert.match(db.calls.find(([kind]) => kind === 'paymentAndWhere')[1], /REGISTRADO/);
  assert.doesNotMatch(db.calls.find(([kind]) => kind === 'paymentAndWhere')[1], /ANULADO/);
});
