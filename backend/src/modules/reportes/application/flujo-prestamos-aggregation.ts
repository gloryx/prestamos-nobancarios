import type { FlujoPeriodoRow } from '../domain/repositories/flujo-prestamos.repository';

export interface FlujoMes { periodo: string; anio: number; mes: number; capitalColocado: number; pagosRecibidos: number; capitalRecuperado: number; gananciaRealizada: number; flujoNeto: number; diferenciaConciliacion: number; estadoDatos: 'OK' | 'ADVERTENCIA' }
export interface FlujoTotal { capitalColocado: number; pagosRecibidos: number; capitalRecuperado: number; gananciaRealizada: number; flujoNeto: number; diferenciaConciliacion: number; estadoDatos: 'OK' | 'ADVERTENCIA'; porcentajeCapitalPagos: number | null; porcentajeInteresPagos: number | null }

const cents = (value: string | number | undefined) => Math.round(Number(value ?? 0) * 100);
const money = (value: number) => value / 100;
const monthRange = (desde: string, hasta: string) => {
  const result: string[] = [];
  let [year, month] = desde.split('-').map(Number);
  const [lastYear, lastMonth] = hasta.split('-').map(Number);
  while (year < lastYear || (year === lastYear && month <= lastMonth)) { result.push(`${year}-${String(month).padStart(2, '0')}`); month++; if (month === 13) { month = 1; year++; } }
  return result;
};

export function aggregateFlujoPrestamos(desde: string, hasta: string, pagos: FlujoPeriodoRow[], desembolsos: FlujoPeriodoRow[]): FlujoMes[] {
  const paymentMap = new Map<string, [number, number, number]>();
  for (const row of pagos) { const current = paymentMap.get(row.periodo) ?? [0, 0, 0]; current[0] += cents(row.monto); current[1] += cents(row.capitalAplicado); current[2] += cents(row.interesAplicado); paymentMap.set(row.periodo, current); }
  const placedMap = new Map<string, number>();
  for (const row of desembolsos) placedMap.set(row.periodo, (placedMap.get(row.periodo) ?? 0) + cents(row.monto));
  return monthRange(desde, hasta).map((periodo) => { const [anio, mes] = periodo.split('-').map(Number); const [payments, capital, interest] = paymentMap.get(periodo) ?? [0, 0, 0]; const placed = placedMap.get(periodo) ?? 0; const reconciliation = payments - capital - interest; return { periodo, anio, mes, capitalColocado: money(placed), pagosRecibidos: money(payments), capitalRecuperado: money(capital), gananciaRealizada: money(interest), flujoNeto: money(payments - placed), diferenciaConciliacion: money(reconciliation), estadoDatos: reconciliation === 0 ? 'OK' : 'ADVERTENCIA' }; });
}

export function totalFlujoPrestamos(rows: FlujoMes[]): FlujoTotal {
  const sum = (key: keyof Pick<FlujoMes, 'capitalColocado' | 'pagosRecibidos' | 'capitalRecuperado' | 'gananciaRealizada' | 'flujoNeto' | 'diferenciaConciliacion'>) => rows.reduce((total, row) => total + cents(row[key]), 0);
  const payments = sum('pagosRecibidos'); const capital = sum('capitalRecuperado'); const interest = sum('gananciaRealizada'); const reconciliation = sum('diferenciaConciliacion');
  return { capitalColocado: money(sum('capitalColocado')), pagosRecibidos: money(payments), capitalRecuperado: money(capital), gananciaRealizada: money(interest), flujoNeto: money(sum('flujoNeto')), diferenciaConciliacion: money(reconciliation), estadoDatos: reconciliation === 0 ? 'OK' : 'ADVERTENCIA', porcentajeCapitalPagos: payments === 0 ? null : Number((capital / payments * 100).toFixed(2)), porcentajeInteresPagos: payments === 0 ? null : Number((interest / payments * 100).toFixed(2)) };
}
