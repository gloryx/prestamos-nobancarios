import type { AnalisisFinancieroPeriodoRow } from '../domain/repositories/analisis-financiero.repository';

export const NOMBRES_MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

export interface AnalisisFinancieroBucket { anio: number; mes?: number; nombreMes?: string; prestamos: number; pagos: number; ganancia: number; diferencia: number }

const cents = (value: string | number | undefined): number => {
  const text = String(value ?? 0).trim();
  const negative = text.startsWith('-');
  const unsigned = negative ? text.slice(1) : text;
  const [whole = '0', fraction = ''] = unsigned.split('.');
  const result = Number(whole || 0) * 100 + Number((fraction + '00').slice(0, 2));
  return (negative ? -1 : 1) * result;
};
const money = (value: number) => value / 100;

function years(desde: number, hasta: number): number[] {
  return Array.from({ length: hasta - desde + 1 }, (_, index) => desde + index);
}

export function totalAnalisisFinanciero(rows: AnalisisFinancieroBucket[], anio: number): AnalisisFinancieroBucket {
  const values = rows.filter((row) => row.anio === anio);
  const sum = (key: 'prestamos' | 'pagos' | 'ganancia') => values.reduce((total, row) => total + cents(row[key]), 0);
  const prestamos = sum('prestamos');
  const pagos = sum('pagos');
  return { anio, prestamos: money(prestamos), pagos: money(pagos), ganancia: money(sum('ganancia')), diferencia: money(pagos - prestamos) };
}

export function aggregateAnalisisFinanciero(anio: number, pagos: AnalisisFinancieroPeriodoRow[], prestamos: AnalisisFinancieroPeriodoRow[]): AnalisisFinancieroBucket[] {
  const paymentMap = new Map<string, [number, number]>();
  for (const row of pagos) {
    const current = paymentMap.get(row.periodo) ?? [0, 0];
    current[0] += cents(row.monto);
    current[1] += cents(row.interesAplicado);
    paymentMap.set(row.periodo, current);
  }
  const loanMap = new Map<string, number>();
  for (const row of prestamos) loanMap.set(row.periodo, (loanMap.get(row.periodo) ?? 0) + cents(row.monto));
  return NOMBRES_MESES.map((nombreMes, index) => {
    const periodo = `${anio}-${String(index + 1).padStart(2, '0')}`;
    const [pagosCents, gananciaCents] = paymentMap.get(periodo) ?? [0, 0];
    const prestamosCents = loanMap.get(periodo) ?? 0;
    return { anio, mes: index + 1, nombreMes, prestamos: money(prestamosCents), pagos: money(pagosCents), ganancia: money(gananciaCents), diferencia: money(pagosCents - prestamosCents) };
  });
}

export function aggregateComparativoFinanciero(desde: number, hasta: number, pagos: AnalisisFinancieroPeriodoRow[], prestamos: AnalisisFinancieroPeriodoRow[]): AnalisisFinancieroBucket[] {
  const monthly = new Map<string, [number, number, number]>();
  for (const row of pagos) {
    const current = monthly.get(row.periodo) ?? [0, 0, 0];
    current[0] += cents(row.monto);
    current[1] += cents(row.interesAplicado);
    monthly.set(row.periodo, current);
  }
  for (const row of prestamos) {
    const current = monthly.get(row.periodo) ?? [0, 0, 0];
    current[2] += cents(row.monto);
    monthly.set(row.periodo, current);
  }
  return years(desde, hasta).map((anio) => {
    const rows = Array.from(monthly.entries()).filter(([periodo]) => periodo.startsWith(`${anio}-`)).map(([periodo, [pagosCents, gananciaCents, prestamosCents]]) => ({ anio, pagos: money(pagosCents), ganancia: money(gananciaCents), prestamos: money(prestamosCents), diferencia: money(pagosCents - prestamosCents), periodo }));
     return totalAnalisisFinanciero(rows, anio);
  });
}
