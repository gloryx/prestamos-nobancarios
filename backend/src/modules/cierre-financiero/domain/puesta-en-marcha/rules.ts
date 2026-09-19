import { PrimerPeriodo, PuestaEnMarchaFinanciera, SaldoPuestaEnMarcha, ContextoPuestaEnMarcha } from './contracts';
import { ConceptoSaldoPuesta, ModalidadPuestaEnMarcha, ProcedenciaSaldo } from './enums';
import { PuestaEnMarchaDomainError } from './errors';

const CONCEPTOS = Object.values(ConceptoSaldoPuesta);
const MODALIDADES = Object.values(ModalidadPuestaEnMarcha);
const PROCEDENCIAS = Object.values(ProcedenciaSaldo);
const MAX_OBSERVACION = 1000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function fail(code: string, message: string): never {
  throw new PuestaEnMarchaDomainError(code, message);
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function dateParts(value: string): [number, number, number] {
  const [, year, month, day] = value.match(DATE_ONLY)!;
  return [Number(year), Number(month), Number(day)];
}

function assertDate(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !DATE_ONLY.test(value)) {
    fail('FECHA_INVALIDA', `${field} debe usar el formato YYYY-MM-DD.`);
  }
  const [year, month, day] = dateParts(value);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    fail('FECHA_INVALIDA', `${field} no representa una fecha válida.`);
  }
}

function assertEnum<T extends string>(value: unknown, values: readonly T[], field: string): asserts value is T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    fail('VALOR_INVALIDO', `${field} no es válido.`);
  }
}

function normalizeText(value: unknown, field: string, required = false): string | undefined {
  if (value === undefined || value === null) {
    if (required) fail('TEXTO_INVALIDO', `${field} es obligatorio.`);
    return undefined;
  }
  if (typeof value !== 'string') fail('TEXTO_INVALIDO', `${field} debe ser texto.`);
  const text = value.trim();
  if (required && text.length === 0) fail('TEXTO_INVALIDO', `${field} es obligatorio.`);
  if (text.length > MAX_OBSERVACION) fail('TEXTO_EXCESIVO', `${field} no puede superar 1000 caracteres.`);
  // The pure contract rejects common direct identifiers rather than storing PII in free text.
  if (text && (/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(text) || /(?:\+?\d[\d\s().-]{6,}\d)/.test(text))) {
    fail('PII_NO_PERMITIDA', `${field} no puede contener datos personales identificables.`);
  }
  return text || undefined;
}

function cents(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    fail('MONTO_INVALIDO', `${field} debe ser un monto finito y no negativo.`);
  }
  const scaled = value * 100;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > 1e-8) {
    fail('MONTO_DECIMALES', `${field} no puede tener más de dos decimales.`);
  }
  return rounded;
}

function validateSaldos(saldos: unknown): SaldoPuestaEnMarcha[] {
  if (!Array.isArray(saldos)) fail('SALDOS_INVALIDOS', 'saldos debe ser un arreglo.');
  if (saldos.length !== CONCEPTOS.length) fail('CONCEPTOS_INCOMPLETOS', 'saldos debe contener exactamente los cuatro conceptos.');
  const seen = new Set<string>();
  const result = saldos.map((saldo, index) => {
    if (!saldo || typeof saldo !== 'object') fail('SALDO_INVALIDO', `El saldo ${index + 1} es inválido.`);
    const item = saldo as Partial<SaldoPuestaEnMarcha>;
    assertEnum(item.concepto, CONCEPTOS, `saldos[${index}].concepto`);
    if (seen.has(item.concepto)) fail('CONCEPTO_DUPLICADO', `El concepto ${item.concepto} está duplicado.`);
    seen.add(item.concepto);
    assertEnum(item.procedencia, PROCEDENCIAS, `saldos[${index}].procedencia`);
    const result: SaldoPuestaEnMarcha = {
      concepto: item.concepto,
      monto: cents(item.monto, `saldos[${index}].monto`) / 100,
      procedencia: item.procedencia,
    };
    const evidencia = normalizeText(item.evidencia, `saldos[${index}].evidencia`);
    const observacion = normalizeText(item.observacion, `saldos[${index}].observacion`);
    if (evidencia !== undefined) result.evidencia = evidencia;
    if (observacion !== undefined) result.observacion = observacion;
    return result;
  });
  if (seen.size !== CONCEPTOS.length || CONCEPTOS.some((concepto) => !seen.has(concepto))) {
    fail('CONCEPTOS_INCOMPLETOS', 'saldos debe contener exactamente los conceptos permitidos.');
  }
  return result;
}

function saldoMap(saldos: SaldoPuestaEnMarcha[]): Record<ConceptoSaldoPuesta, SaldoPuestaEnMarcha> {
  return Object.fromEntries(saldos.map((saldo) => [saldo.concepto, saldo])) as Record<ConceptoSaldoPuesta, SaldoPuestaEnMarcha>;
}

function assertPortfolioOrder(saldos: SaldoPuestaEnMarcha[], required: ModalidadPuestaEnMarcha): void {
  const map = saldoMap(saldos);
  if (cents(map[ConceptoSaldoPuesta.CARTERA_ACTIVA].monto, 'CARTERA_ACTIVA') + cents(map[ConceptoSaldoPuesta.CARTERA_INCOBRABLE].monto, 'CARTERA_INCOBRABLE') > cents(map[ConceptoSaldoPuesta.CARTERA_TOTAL].monto, 'CARTERA_TOTAL')) {
    fail('CARTERA_INCONSISTENTE', `${required}: cartera activa más incobrable no puede superar la cartera total.`);
  }
}

export function deriveFechaBase(fechaInicioCierres: string): string {
  assertDate(fechaInicioCierres, 'fechaInicioCierres');
  let [year, month, day] = dateParts(fechaInicioCierres);
  if (day > 1) {
    day -= 1;
  } else if (month > 1) {
    month -= 1;
    day = daysInMonth(year, month);
  } else {
    year -= 1;
    month = 12;
    day = 31;
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function derivePrimerPeriodo(modalidad: ModalidadPuestaEnMarcha, fechaInicioCierres: string): PrimerPeriodo {
  assertEnum(modalidad, MODALIDADES, 'modalidad');
  assertDate(fechaInicioCierres, 'fechaInicioCierres');
  const [, , monthText, dayText] = fechaInicioCierres.match(DATE_ONLY)!;
  const month = Number(monthText);
  const day = Number(dayText);
  if (modalidad !== ModalidadPuestaEnMarcha.NEGOCIO_NUEVO && day !== 1) {
    fail('INICIO_NO_MENSUAL', 'Históricos completos y migración de saldos deben iniciar el primer día del mes.');
  }
  const [year] = dateParts(fechaInicioCierres);
  const inicio = fechaInicioCierres;
  return { fechaInicio: inicio, fechaFin: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(daysInMonth(year, month)).padStart(2, '0')}` };
}

export function calculateCarteraNoClasificada(saldos: readonly SaldoPuestaEnMarcha[]): number {
  const validated = validateSaldos(saldos);
  const map = saldoMap(validated);
  return (cents(map[ConceptoSaldoPuesta.CARTERA_TOTAL].monto, 'CARTERA_TOTAL') - cents(map[ConceptoSaldoPuesta.CARTERA_ACTIVA].monto, 'CARTERA_ACTIVA') - cents(map[ConceptoSaldoPuesta.CARTERA_INCOBRABLE].monto, 'CARTERA_INCOBRABLE')) / 100;
}

export function crearPuestaEnMarcha(input: PuestaEnMarchaFinanciera, contexto: ContextoPuestaEnMarcha = {}): PuestaEnMarchaFinanciera {
  if (!input || typeof input !== 'object') fail('CONTRATO_INVALIDO', 'La puesta en marcha es obligatoria.');
  assertEnum(input.modalidad, MODALIDADES, 'modalidad');
  assertDate(input.fechaInicioCierres, 'fechaInicioCierres');
  const fechaBase = deriveFechaBase(input.fechaInicioCierres);
  if (input.fechaBase !== fechaBase) fail('FECHA_BASE_INCONSISTENTE', 'fechaBase debe ser exactamente el día anterior a fechaInicioCierres.');
  if (contexto.fechaApertura !== undefined) {
    assertDate(contexto.fechaApertura, 'fechaApertura');
    if (input.fechaInicioCierres < contexto.fechaApertura) fail('FECHA_APERTURA_INCONSISTENTE', 'fechaInicioCierres no puede ser anterior a fechaApertura.');
  }
  if (input.modalidad !== ModalidadPuestaEnMarcha.NEGOCIO_NUEVO && !input.fechaInicioCierres.endsWith('-01')) {
    fail('INICIO_NO_MENSUAL', 'Históricos completos y migración de saldos deben iniciar el primer día del mes.');
  }
  const saldos = validateSaldos(input.saldos);
  const map = saldoMap(saldos);
  const cartera = [ConceptoSaldoPuesta.CARTERA_TOTAL, ConceptoSaldoPuesta.CARTERA_ACTIVA, ConceptoSaldoPuesta.CARTERA_INCOBRABLE];
  if (input.modalidad === ModalidadPuestaEnMarcha.NEGOCIO_NUEVO) {
    for (const concepto of cartera) {
      if (map[concepto].monto !== 0 || map[concepto].procedencia !== ProcedenciaSaldo.NO_APLICA) fail('NEGOCIO_NUEVO_CARTERA_INVALIDA', 'Negocio nuevo exige cartera en cero y procedencia NO_APLICA.');
    }
    if (map[ConceptoSaldoPuesta.DISPONIBLE].procedencia === ProcedenciaSaldo.RECONSTRUIDO) fail('NEGOCIO_NUEVO_DISPONIBLE_RECONSTRUIDO', 'Negocio nuevo no admite disponible RECONSTRUIDO.');
    if (map[ConceptoSaldoPuesta.DISPONIBLE].procedencia !== ProcedenciaSaldo.DECLARADO) fail('NEGOCIO_NUEVO_DISPONIBLE_INVALIDO', 'Negocio nuevo exige disponible DECLARADO.');
  } else {
    for (const concepto of cartera) {
      const allowed = input.modalidad === ModalidadPuestaEnMarcha.HISTORICO_COMPLETO ? [ProcedenciaSaldo.RECONSTRUIDO] : [ProcedenciaSaldo.RECONSTRUIDO, ProcedenciaSaldo.DECLARADO];
      if (!allowed.includes(map[concepto].procedencia)) fail('PROCEDENCIA_INVALIDA', `${concepto} no tiene una procedencia válida para la modalidad.`);
    }
    if (![ProcedenciaSaldo.RECONSTRUIDO, ProcedenciaSaldo.DECLARADO].includes(map[ConceptoSaldoPuesta.DISPONIBLE].procedencia)) fail('PROCEDENCIA_INVALIDA', 'Disponible no tiene una procedencia válida.');
    assertPortfolioOrder(saldos, input.modalidad);
  }
  const disponible = map[ConceptoSaldoPuesta.DISPONIBLE];
  if (input.modalidad === ModalidadPuestaEnMarcha.NEGOCIO_NUEVO && disponible.procedencia === ProcedenciaSaldo.RECONSTRUIDO) fail('NEGOCIO_NUEVO_DISPONIBLE_RECONSTRUIDO', 'Negocio nuevo no admite disponible RECONSTRUIDO.');
  return { modalidad: input.modalidad, fechaBase, fechaInicioCierres: input.fechaInicioCierres, saldos, observaciones: normalizeText(input.observaciones, 'observaciones') };
}
