export type PeriodicidadPago = 'DIARIO' | 'SEMANAL' | 'QUINCENAL' | 'MENSUAL';

const atUtcMidnight = (date: Date): Date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const addDays = (date: Date, days: number): Date => {
  const result = atUtcMidnight(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};
const addMonthsClamped = (date: Date): Date => {
  const source = atUtcMidnight(date);
  const month = source.getUTCMonth() + 1;
  const sourceLastDay = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + 1, 0)).getUTCDate();
  const targetLastDay = new Date(Date.UTC(source.getUTCFullYear(), month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(source.getUTCFullYear(), month, source.getUTCDate() === sourceLastDay ? targetLastDay : Math.min(source.getUTCDate(), targetLastDay)));
};
const moveSundayToMonday = (date: Date): Date => date.getUTCDay() === 0 ? addDays(date, 1) : date;

export const fechaDateOnly = (date: Date): string => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

export function calcularFechaLimiteContractual(fechaAlta: Date, periodicidad: string, cantidadPagos: number): string {
  const normalized = periodicidad.trim().toUpperCase() as PeriodicidadPago;
  let date = atUtcMidnight(fechaAlta);
  for (let index = 0; index < cantidadPagos; index += 1) {
    date = moveSundayToMonday(normalized === 'DIARIO' ? addDays(date, 1) : normalized === 'SEMANAL' ? addDays(date, 7) : normalized === 'QUINCENAL' ? addDays(date, 15) : addMonthsClamped(date));
  }
  return fechaDateOnly(date);
}
