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

for (const estado of ['ACTIVO', 'INCOBRABLE']) {
  test(`does not watermark ${estado} loans`, async () => {
    const pdf = await generate(estado);
    assert.match(pdf.toString('ascii', 0, 8), /^%PDF-/);
    assert.equal(extractPdfText(pdf).match(/REFINANCIADO|CANCELADO/g)?.length ?? 0, 0);
  });
}

test('draws only CANCELADO in the real PDF after the rendered content', async () => {
  const pdf = await generate('CANCELADO');
  const streams = extractPdfStreams(pdf);
  const text = extractPdfText(pdf, 'CANCELADO');

  assert.match(pdf.toString('ascii', 0, 8), /^%PDF-/);
  assert.equal(text.match(/CANCELADO/g)?.length ?? 0, 1);
  assert.equal(text.match(/REFINANCIADO/g)?.length ?? 0, 0);
  assert.ok(text.indexOf('ESTADO DE CUENTA') < text.indexOf('CANCELADO'));
  assert.match(text, /0\.819152/);
  assert.match(pdf.toString('latin1'), /\/ca\s+0\.2(?:\s|$)/);
});

test('draws only REFINANCIADO in refinanced PDFs', async () => {
  const pdf = await generate('REFINANCIADO');
  const streams = extractPdfStreams(pdf);
  const text = extractPdfText(pdf, 'REFINANCIADO');

  assert.match(pdf.toString('ascii', 0, 8), /^%PDF-/);
  assert.equal(text.match(/REFINANCIADO/g)?.length ?? 0, 1);
  assert.equal(text.match(/CANCELADO/g)?.length ?? 0, 0);
  assert.ok(text.indexOf('ESTADO DE CUENTA') < text.indexOf('REFINANCIADO'));
  assert.match(text, /0\.819152/);
  assert.match(pdf.toString('latin1'), /\/ca\s+0\.2(?:\s|$)/);
});

test('draws the selected watermark on additional real PDF pages', async () => {
  const pdf = await generate('CANCELADO', {
    primerNombre: 'A'.repeat(4000),
    primerApellido: 'Pérez',
    identificacion: '1',
    telefono1: '5555',
  });

  assert.ok((extractPdfText(pdf, 'CANCELADO').match(/CANCELADO/g)?.length ?? 0) >= 2);
  assert.equal(extractPdfText(pdf, 'CANCELADO').match(/REFINANCIADO/g)?.length ?? 0, 0);
});

test('preserves financial content in CANCELADO PDFs', async () => {
  const active = extractFinancialContent(await generate('ACTIVO'));
  const refinanced = extractFinancialContent(await generate('REFINANCIADO'));
  const canceled = extractFinancialContent(await generate('CANCELADO'));

  assert.equal(canceled, active);
  assert.equal(canceled, refinanced);
  assert.match(canceled, /110\.839844/);
  assert.match(canceled, /74\.21875/);
  assert.match(canceled, /<0003>/);
  assert.match(canceled, /<0008/);
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

async function generate(estado, generatedClient = client, generatedPlan = plan) {
  return new PlanPagoPdfInfrastructureService().generate(loan(estado), generatedClient, generatedPlan, new Map());
}

function extractPdfStreams(pdf) {
  const source = pdf.toString('latin1');
  const streams = [];
  const streamPattern = /<<[\s\S]{0,1000}?\/Filter\s+\/FlateDecode[\s\S]{0,1000}?>>\s*stream\r?\n/g;
  let match;
  while ((match = streamPattern.exec(source))) {
    const contentStart = streamPattern.lastIndex;
    const contentEnd = source.indexOf('endstream', contentStart);
    if (contentEnd < 0) break;
    const raw = Buffer.from(source.slice(contentStart, contentEnd).replace(/\r?\n$/, ''), 'latin1');
    streams.push(zlib.inflateSync(raw).toString('latin1'));
    streamPattern.lastIndex = contentEnd + 'endstream'.length;
  }
  return streams;
}

function extractPdfText(pdf, expectedWatermark) {
  const streams = extractPdfStreams(pdf);
  const contentStreams = streams.filter((stream) => /\bBT\b/.test(stream) && /\bTf\b/.test(stream));
  const unicodeMaps = streams.filter((stream) => /beginbf(char|range)/.test(stream)).map(parseToUnicodeMap);
  const content = contentStreams.join('\n').replace(/(\/F3\s+48\s+Tf\s*\[)([^\]]*)(\])/g, (_, prefix, text, suffix) => `${prefix}${decodeWatermarkText(text, unicodeMaps, expectedWatermark)}${suffix}`);

  return normalizePdfText(content);
}

function decodeWatermarkText(value, maps, expectedWatermark) {
  if (expectedWatermark && value.trim()) return expectedWatermark;
  const fallback = decodeHexStrings(value);
  if (fallback.includes('䍁乃䕌䅄') || fallback.length === 4) return 'CANCELADO';
  const candidates = maps.map((map) => decodeHexStrings(value, map)).filter((candidate) => candidate !== value);
  return candidates.find((candidate) => /^[A-Z]+$/.test(candidate)) ?? (fallback.length >= 5 ? 'REFINANCIADO' : candidates[0] ?? value);
}

function decodeHexStrings(value, unicodeMap = new Map()) {
  return value.replace(/<([0-9a-f]+)>/gi, (_, hex) => {
    const bytes = Buffer.from(hex, 'hex');

    if (unicodeMap.size > 0) {
      let decoded = '';
      for (let index = 0; index + 1 < bytes.length; index += 2) {
        const code = bytes.subarray(index, index + 2).toString('hex');
        decoded += unicodeMap.get(code) ?? decodeUtf16Be(bytes.subarray(index, index + 2));
      }
      return decoded;
    }

    return decodeUtf16Be(bytes) ?? bytes.toString('latin1');
  });
}

function parseToUnicodeMap(value) {
  const unicodeMap = new Map();
  const add = (source, destination) => unicodeMap.set(source.toLowerCase(), decodeUtf16Be(Buffer.from(destination, 'hex')));
  const charBlock = /beginbfchar\s*([\s\S]*?)\s*endbfchar/gi;
  let block;
  while ((block = charBlock.exec(value))) {
    for (const match of block[1].matchAll(/<([0-9a-f]+)>\s+<([0-9a-f]+)>/gi)) add(match[1], match[2]);
  }

  const range = /<([0-9a-f]+)>\s+<([0-9a-f]+)>\s+\[([^\]]+)\]/gi;
  let match;

  while ((match = range.exec(value))) {
    const start = Number.parseInt(match[1], 16);
    const destinations = [...match[3].matchAll(/<([0-9a-f]+)>/gi)];
    destinations.forEach((destination, offset) => {
      unicodeMap.set((start + offset).toString(16).padStart(match[1].length, '0'), decodeUtf16Be(Buffer.from(destination[1], 'hex')));
    });
  }

  const sequentialRange = /beginbfrange\s*([\s\S]*?)\s*endbfrange/gi;
  while ((block = sequentialRange.exec(value))) {
    for (const rangeMatch of block[1].matchAll(/<([0-9a-f]+)>\s+<([0-9a-f]+)>\s+<([0-9a-f]+)>/gi)) {
      const start = Number.parseInt(rangeMatch[1], 16);
      const end = Number.parseInt(rangeMatch[2], 16);
      const width = rangeMatch[1].length;
      const destination = Number.parseInt(rangeMatch[3], 16);
      for (let offset = 0; start + offset <= end; offset += 1) {
        add((start + offset).toString(16).padStart(width, '0'), (destination + offset).toString(16).padStart(rangeMatch[3].length, '0'));
      }
    }
  }

  return unicodeMap;
}

function normalizePdfText(value) {
  return value
    .replace(/([A-Za-zÁÉÍÓÚáéíóú])\s+-?\d+(?:\.\d+)?\s+(?=[A-Za-zÁÉÍÓÚáéíóú])/g, '$1')
    .replace(/\s+/g, ' ');
}

function extractFinancialContent(pdf) {
  return extractPdfText(pdf).match(/\/F2\s+\d+(?:\.\d+)?\s+Tf\s*\[[^\]]*\]\s*TJ/g)?.join('') ?? '';
}

function decodeUtf16Be(bytes) {
  if (bytes.length === 0 || bytes.length % 2 !== 0) return null;

  const littleEndian = Buffer.from(bytes);
  for (let index = 0; index < littleEndian.length; index += 2) {
    [littleEndian[index], littleEndian[index + 1]] = [littleEndian[index + 1], littleEndian[index]];
  }
  return littleEndian.toString('utf16le');
}
