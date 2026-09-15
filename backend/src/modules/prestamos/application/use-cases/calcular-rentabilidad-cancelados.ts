import { RentabilidadCanceladaFact } from '../../domain/repositories/rentabilidad-cancelados.repository';

export const PLAZO_GROUPS = [
  { key: 'HASTA_15', label: '15 días o menos', min: 1, max: 15 },
  { key: '16_30', label: '16–30 días', min: 16, max: 30 },
  { key: '31_45', label: '31–45 días', min: 31, max: 45 },
  { key: '46_60', label: '46–60 días', min: 46, max: 60 },
  { key: 'MAS_60', label: 'Más de 60 días', min: 61, max: Number.POSITIVE_INFINITY },
] as const;

type GroupAccumulator = { cantidad: number; capital: number; ganancia: number; capitalPonderadoTasa30: number };

const money = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
const percent = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

const daysBetween = (from: string, to: string) => {
  const start = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.floor((end - start) / 86_400_000);
};

const emptyAccumulator = (): GroupAccumulator => ({ cantidad: 0, capital: 0, ganancia: 0, capitalPonderadoTasa30: 0 });

export function calcularRentabilidadCancelados(facts: RentabilidadCanceladaFact[]) {
  const grupos = new Map(PLAZO_GROUPS.map((group) => [group.key, emptyAccumulator()]));
  let capitalTotal = 0;
  let gananciaTotal = 0;
  let validosTemporales = 0;
  let registrosSinDuracionValida = 0;
  let capitalTemporalValido = 0;
  let capitalPonderadoTasa30 = 0;

  for (const fact of facts) {
    const capital = Number(fact.capital) || 0;
    const ganancia = Number(fact.ganancia) || 0;
    capitalTotal += capital;
    gananciaTotal += ganancia;
    const days = daysBetween(fact.fechaAlta, fact.fechaCancelacion);
    if (days <= 0) {
      registrosSinDuracionValida += 1;
      continue;
    }
    validosTemporales += 1;
    capitalTemporalValido += capital;
    const tasa30 = capital > 0 ? (ganancia / capital) * (30 / days) * 100 : 0;
    capitalPonderadoTasa30 += capital * tasa30;
    const group = PLAZO_GROUPS.find((item) => days >= item.min && days <= item.max);
    if (!group) continue;
    const accumulator = grupos.get(group.key)!;
    accumulator.cantidad += 1;
    accumulator.capital += capital;
    accumulator.ganancia += ganancia;
    accumulator.capitalPonderadoTasa30 += capital * tasa30;
  }

  const toGroup = (group: typeof PLAZO_GROUPS[number]) => {
    const accumulator = grupos.get(group.key)!;
    return {
      plazo: group.label,
      cantidad: accumulator.cantidad,
      capital: money(accumulator.capital),
      ganancia: money(accumulator.ganancia),
      rentabilidadTotal: percent(accumulator.capital > 0 ? (accumulator.ganancia / accumulator.capital) * 100 : 0),
      tasa30Dias: percent(accumulator.capital > 0 ? accumulator.capitalPonderadoTasa30 / accumulator.capital : 0),
    };
  };

  return {
    anio: 0,
    mes: 0,
    resumen: {
      prestamosCancelados: facts.length,
      capitalTotal: money(capitalTotal),
      gananciaTotal: money(gananciaTotal),
      rentabilidadTotal: percent(capitalTotal > 0 ? (gananciaTotal / capitalTotal) * 100 : 0),
      tasa30Dias: percent(capitalTemporalValido > 0 ? capitalPonderadoTasa30 / capitalTemporalValido : 0),
    },
    metadata: { registrosConDuracionValida: validosTemporales, registrosSinDuracionValida, capitalTemporalValido: money(capitalTemporalValido) },
    porPlazo: PLAZO_GROUPS.map(toGroup),
  };
}
