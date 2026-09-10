const assert = require('node:assert/strict');
const test = require('node:test');
const zlib = require('node:zlib');

const { PlanPagoPdfInfrastructureService } = require('../dist/modules/prestamos/infrastructure/reports/plan-pago-pdf.infrastructure-service');
const { PlanPagoPdfService } = require('../dist/modules/prestamos/application/services/plan-pago-pdf.service');

const loan = (estado) => ({
  id: 1,
  clienteId: 2,
  estado,
  fechaAlta: new Date('2026-01-01T00:00:00Z'),
  capital: 100,
  interes: 10,
  montoTotal: 110,
  cantidadPagos: 1,
  periodicidadPago: { nombre: 'Mensual' },
  formaPago: { nombre: 'Efectivo' },
});
const client = { primerNombre: 'Ana', primerApellido: 'Pérez', identificacion: '1', telefono1: '5555' };
const plan = [{ id: 1, numeroPago: 1, fechaVencimiento: new Date('2026-02-01T00:00:00Z'), montoProgramado: 110 }];

for (const estado of ['ACTIVO', 'CANCELADO', 'INCOBRABLE']) {
  test(`does not watermark ${estado} loans`, async () => {
    const pdf = await generate(estado);
    assert.match(pdf.toString('ascii', 0, 8), /^%PDF-/);
    assert.equal(extractPdfText(pdf).filter((value) => value === 'REFINANCIADO').length, 0);
  });
}

test('draws the watermark in the real PDF after the rendered content', async () => {
  const pdf = await generate('REFINANCIADO');
  const streams = extractPdfStreams(pdf);
  const text = decodeHexStrings(streams.join('\n'));

  assert.match(pdf.toString('ascii', 0, 8), /^%PDF-/);
  assert.equal(extractPdfText(pdf).filter((value) => value === 'REFINANCIADO').length, 1);
  assert.ok(text.indexOf('ESTADO DE CUENTA') < text.indexOf('REFINANCIADO'));
  assert.match(text, /0\.819152/);
  assert.match(pdf.toString('latin1'), /\/ca\s+0\.2(?:\s|$)/);
});

test('keeps the existing statement flow without an additional loan query', async () => {
  const calls = { loan: 0, client: 0, plan: 0, paymentQuery: 0, generate: 0 };
  const paymentQuery = {
    innerJoin() { return this; }, select() { return this; }, addSelect() { return this; },
    where() { return this; }, andWhere() { return this; }, groupBy() { return this; },
    getRawMany: async () => { calls.paymentQuery += 1; return []; },
  };
  const pdf = { generate: async () => { calls.generate += 1; return Buffer.from('pdf'); } };
  const statement = new PlanPagoPdfService(
    { buscarPorId: async () => { calls.loan += 1; return loan('REFINANCIADO'); } },
    { buscarPorId: async () => { calls.client += 1; return client; } },
    { buscarPorPrestamoId: async () => { calls.plan += 1; return plan; } },
    pdf,
    { createQueryBuilder: () => paymentQuery },
  );

  await statement.executeEstadoCuenta(1);
  assert.deepEqual(calls, { loan: 1, client: 1, plan: 1, paymentQuery: 1, generate: 1 });
});

async function generate(estado) {
  return new PlanPagoPdfInfrastructureService().generate(loan(estado), client, plan, new Map());
}

function extractPdfStreams(pdf) {
  const source = pdf.toString('latin1');
  const streams = [];
  const streamPattern = /\/Length\s+(\d+)\s*\/Filter\s+\/FlateDecode\s*>>\s*stream\r?\n/g;
  let match;
  while ((match = streamPattern.exec(source))) {
    const length = Number(match[1]);
    const contentStart = streamPattern.lastIndex;
    const raw = Buffer.from(source.slice(contentStart, contentStart + length), 'latin1');
    streams.push(zlib.inflateSync(raw).toString('latin1'));
    streamPattern.lastIndex = contentStart + length;
  }
  return streams;
}

function extractPdfText(pdf) {
  return decodeHexStrings(extractPdfStreams(pdf).join('\n')).match(/REFINANCIADO/g) ?? [];
}

function decodeHexStrings(value) {
  return value.replace(/<([0-9a-f]+)>/gi, (_, hex) => Buffer.from(hex, 'hex').toString('latin1'));
}
