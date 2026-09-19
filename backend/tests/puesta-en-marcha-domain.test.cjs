const test = require('node:test');
const assert = require('node:assert/strict');
const domain = require('../dist/modules/cierre-financiero/domain/puesta-en-marcha');

const { ConceptoSaldoPuesta: C, ModalidadPuestaEnMarcha: M, ProcedenciaSaldo: P } = domain;

const saldos = (values, provenance = P.DECLARADO) => [
  { concepto: C.DISPONIBLE, monto: values.disponible, procedencia: provenance },
  { concepto: C.CARTERA_TOTAL, monto: values.total, procedencia: provenance },
  { concepto: C.CARTERA_ACTIVA, monto: values.activa, procedencia: provenance },
  { concepto: C.CARTERA_INCOBRABLE, monto: values.incobrable, procedencia: provenance },
];

const saldosNuevo = (disponible, cartera = {}) => [
  { concepto: C.DISPONIBLE, monto: disponible, procedencia: P.DECLARADO },
  { concepto: C.CARTERA_TOTAL, monto: cartera.total ?? 0, procedencia: cartera.procedencia ?? P.NO_APLICA },
  { concepto: C.CARTERA_ACTIVA, monto: cartera.activa ?? 0, procedencia: cartera.procedencia ?? P.NO_APLICA },
  { concepto: C.CARTERA_INCOBRABLE, monto: cartera.incobrable ?? 0, procedencia: cartera.procedencia ?? P.NO_APLICA },
];

const input = (modalidad, fechaInicioCierres, items, overrides = {}) => ({
  modalidad,
  fechaBase: domain.deriveFechaBase(fechaInicioCierres),
  fechaInicioCierres,
  saldos: items,
  ...overrides,
});

const assertCode = (callback, code) => assert.throws(callback, (error) => error && error.name === 'PuestaEnMarchaDomainError' && error.code === code);

test('validates new business on day one and mid-month', () => {
  assert.doesNotThrow(() => domain.crearPuestaEnMarcha(input(M.NEGOCIO_NUEVO, '2026-02-01', saldosNuevo(0))));
  const result = domain.crearPuestaEnMarcha(input(M.NEGOCIO_NUEVO, '2026-02-15', saldosNuevo(10.01)));
  assert.equal(result.fechaBase, '2026-02-14');
  assert.equal(result.saldos.find((saldo) => saldo.concepto === C.CARTERA_TOTAL).monto, 0);
});

test('enforces exact previous-day dates and rejects invalid calendars', () => {
  assertCode(() => domain.crearPuestaEnMarcha(input(M.NEGOCIO_NUEVO, '2026-03-01', saldosNuevo(1), { fechaBase: '2026-03-01' })), 'FECHA_BASE_INCONSISTENTE');
  assertCode(() => domain.crearPuestaEnMarcha(input(M.NEGOCIO_NUEVO, '2026-03-01', saldosNuevo(1), { fechaBase: '2026-03-02' })), 'FECHA_BASE_INCONSISTENTE');
  assertCode(() => domain.crearPuestaEnMarcha(input(M.NEGOCIO_NUEVO, '2026-03-01', saldosNuevo(1), { fechaBase: '2026-02-27' })), 'FECHA_BASE_INCONSISTENTE');
  assert.equal(domain.deriveFechaBase('2026-01-01'), '2025-12-31');
  assert.equal(domain.deriveFechaBase('2024-03-01'), '2024-02-29');
  assert.equal(domain.deriveFechaBase('2023-03-01'), '2023-02-28');
  for (const date of ['2026-02-30', '2025-02-29', '2026-13-01', '2026-00-01', '2026-1-01', '2026-01-1']) {
    assertCode(() => domain.deriveFechaBase(date), 'FECHA_INVALIDA');
  }
});

test('derivePrimerPeriodo preserves exact starts and covers normal and leap February', () => {
  assert.deepEqual(domain.derivePrimerPeriodo(M.NEGOCIO_NUEVO, '2024-02-29'), { fechaInicio: '2024-02-29', fechaFin: '2024-02-29' });
  assert.deepEqual(domain.derivePrimerPeriodo(M.NEGOCIO_NUEVO, '2026-02-15'), { fechaInicio: '2026-02-15', fechaFin: '2026-02-28' });
  assert.deepEqual(domain.derivePrimerPeriodo(M.HISTORICO_COMPLETO, '2024-02-01'), { fechaInicio: '2024-02-01', fechaFin: '2024-02-29' });
  assert.deepEqual(domain.derivePrimerPeriodo(M.MIGRACION_SALDOS, '2025-02-01'), { fechaInicio: '2025-02-01', fechaFin: '2025-02-28' });
  assertCode(() => domain.derivePrimerPeriodo(M.HISTORICO_COMPLETO, '2024-02-15'), 'INICIO_NO_MENSUAL');
  assertCode(() => domain.derivePrimerPeriodo(M.MIGRACION_SALDOS, '2024-02-15'), 'INICIO_NO_MENSUAL');
});

test('enforces new-business zero portfolio and provenance rules', () => {
  assertCode(() => domain.crearPuestaEnMarcha(input(M.NEGOCIO_NUEVO, '2026-02-01', saldosNuevo(1, { total: 1 }))), 'NEGOCIO_NUEVO_CARTERA_INVALIDA');
  assertCode(() => domain.crearPuestaEnMarcha(input(M.NEGOCIO_NUEVO, '2026-02-01', saldosNuevo(1, { procedencia: P.DECLARADO }))), 'NEGOCIO_NUEVO_CARTERA_INVALIDA');
  const reconstructedAvailable = saldosNuevo(1);
  reconstructedAvailable[0].procedencia = P.RECONSTRUIDO;
  assertCode(() => domain.crearPuestaEnMarcha(input(M.NEGOCIO_NUEVO, '2026-02-01', reconstructedAvailable)), 'NEGOCIO_NUEVO_DISPONIBLE_RECONSTRUIDO');
});

test('enforces complete-history rules and permits declared available', () => {
  const valid = saldos({ disponible: 10, total: 100, activa: 70, incobrable: 20 }, P.RECONSTRUIDO);
  assert.doesNotThrow(() => domain.crearPuestaEnMarcha(input(M.HISTORICO_COMPLETO, '2026-02-01', valid)));
  const declaredAvailable = saldos({ disponible: 10, total: 100, activa: 70, incobrable: 20 }, P.RECONSTRUIDO);
  declaredAvailable[0].procedencia = P.DECLARADO;
  assert.doesNotThrow(() => domain.crearPuestaEnMarcha(input(M.HISTORICO_COMPLETO, '2026-02-01', declaredAvailable)));
  for (const provenance of [P.DECLARADO, P.NO_APLICA]) {
    const invalid = saldos({ disponible: 10, total: 100, activa: 70, incobrable: 20 }, P.RECONSTRUIDO);
    invalid[1].procedencia = provenance;
    assertCode(() => domain.crearPuestaEnMarcha(input(M.HISTORICO_COMPLETO, '2026-02-01', invalid)), 'PROCEDENCIA_INVALIDA');
  }
  assertCode(() => domain.crearPuestaEnMarcha(input(M.HISTORICO_COMPLETO, '2026-02-01', saldos({ disponible: 10, total: 100, activa: 80, incobrable: 21 }, P.RECONSTRUIDO))), 'CARTERA_INCONSISTENTE');
  assertCode(() => domain.crearPuestaEnMarcha(input(M.HISTORICO_COMPLETO, '2026-02-15', valid)), 'INICIO_NO_MENSUAL');
});

test('enforces migration dates, allows mixed provenance, and derives unclassified portfolio', () => {
  const mixed = saldos({ disponible: 10, total: 100, activa: 70, incobrable: 20 });
  mixed[0].procedencia = P.RECONSTRUIDO;
  mixed[2].procedencia = P.RECONSTRUIDO;
  assert.doesNotThrow(() => domain.crearPuestaEnMarcha(input(M.MIGRACION_SALDOS, '2026-03-01', mixed)));
  for (const availableProvenance of [P.DECLARADO, P.RECONSTRUIDO]) {
    const values = saldos({ disponible: 10, total: 100, activa: 70, incobrable: 20 });
    values[0].procedencia = availableProvenance;
    assert.doesNotThrow(() => domain.crearPuestaEnMarcha(input(M.MIGRACION_SALDOS, '2026-03-01', values)));
  }
  assert.equal(domain.calculateCarteraNoClasificada(mixed), 10);
  assert.equal(domain.calculateCarteraNoClasificada(saldos({ disponible: 0, total: 100, activa: 70, incobrable: 30 })), 0);
  assertCode(() => domain.crearPuestaEnMarcha(input(M.MIGRACION_SALDOS, '2026-03-15', mixed)), 'INICIO_NO_MENSUAL');
});

test('requires exactly the four concepts regardless of order', () => {
  const valid = saldos({ disponible: 1, total: 100, activa: 70, incobrable: 20 }, P.RECONSTRUIDO).reverse();
  assert.doesNotThrow(() => domain.crearPuestaEnMarcha(input(M.HISTORICO_COMPLETO, '2026-04-01', valid)));
  const duplicate = saldos({ disponible: 1, total: 100, activa: 70, incobrable: 20 }, P.RECONSTRUIDO);
  duplicate[3].concepto = C.CARTERA_ACTIVA;
  assertCode(() => domain.crearPuestaEnMarcha(input(M.HISTORICO_COMPLETO, '2026-04-01', duplicate)), 'CONCEPTO_DUPLICADO');
  const missing = saldos({ disponible: 1, total: 100, activa: 70, incobrable: 20 }, P.RECONSTRUIDO).slice(0, 3);
  assertCode(() => domain.crearPuestaEnMarcha(input(M.HISTORICO_COMPLETO, '2026-04-01', missing)), 'CONCEPTOS_INCOMPLETOS');
  const unknown = saldos({ disponible: 1, total: 100, activa: 70, incobrable: 20 }, P.RECONSTRUIDO);
  unknown[3].concepto = 'OTRO';
  assertCode(() => domain.crearPuestaEnMarcha(input(M.HISTORICO_COMPLETO, '2026-04-01', unknown)), 'VALOR_INVALIDO');
});

test('validates zero, cent, negative, non-finite, and excessive-decimal amounts', () => {
  for (const amount of [0, 0.01]) {
    assert.doesNotThrow(() => domain.crearPuestaEnMarcha(input(M.NEGOCIO_NUEVO, '2026-05-01', saldosNuevo(amount))));
  }
  for (const amount of [-0.01, Number.NaN, Number.POSITIVE_INFINITY, 1.001]) {
    assertCode(() => domain.crearPuestaEnMarcha(input(M.NEGOCIO_NUEVO, '2026-05-01', saldosNuevo(amount))), amount === 1.001 ? 'MONTO_DECIMALES' : 'MONTO_INVALIDO');
  }
});

test('validates opening context, text normalization, limits, and safe invalid derivation', () => {
  assert.doesNotThrow(() => domain.crearPuestaEnMarcha(input(M.NEGOCIO_NUEVO, '2026-06-15', saldosNuevo(1)), { fechaApertura: '2026-06-15' }));
  assert.doesNotThrow(() => domain.crearPuestaEnMarcha(input(M.NEGOCIO_NUEVO, '2026-06-15', saldosNuevo(1)), { fechaApertura: '2026-06-01' }));
  assertCode(() => domain.crearPuestaEnMarcha(input(M.NEGOCIO_NUEVO, '2026-06-15', saldosNuevo(1)), { fechaApertura: '2026-06-30' }), 'FECHA_APERTURA_INCONSISTENTE');
  assertCode(() => domain.crearPuestaEnMarcha(input(M.NEGOCIO_NUEVO, '2026-06-15', saldosNuevo(1)), { fechaApertura: '2026-02-30' }), 'FECHA_INVALIDA');
  const normalized = domain.crearPuestaEnMarcha(input(M.NEGOCIO_NUEVO, '2026-06-15', saldosNuevo(1), { observaciones: '  nota  ' }));
  assert.equal(normalized.observaciones, 'nota');
  assert.doesNotThrow(() => domain.crearPuestaEnMarcha(input(M.NEGOCIO_NUEVO, '2026-06-15', saldosNuevo(1), { observaciones: 'x'.repeat(1000) })));
  assertCode(() => domain.crearPuestaEnMarcha(input(M.NEGOCIO_NUEVO, '2026-06-15', saldosNuevo(1), { observaciones: 'x'.repeat(1001) })), 'TEXTO_EXCESIVO');
  assertCode(() => domain.calculateCarteraNoClasificada([]), 'CONCEPTOS_INCOMPLETOS');
});

test('is pure and deterministic', () => {
  const original = input(M.NEGOCIO_NUEVO, '2026-07-15', saldosNuevo(1.2), { observaciones: '  apertura  ' });
  const snapshot = JSON.parse(JSON.stringify(original));
  const first = domain.crearPuestaEnMarcha(original);
  const second = domain.crearPuestaEnMarcha(original);
  assert.deepEqual(original, snapshot);
  assert.deepEqual(first, second);
  assert.equal(domain.deriveFechaBase('2026-07-01'), '2026-06-30');
});
