import type { ProyeccionFinancieraData, ProyeccionPlanRow } from '../domain/repositories/analisis-financiero.repository';

export type ProyeccionPeriodo = '15d' | '1m' | '2m' | '3m' | 'cartera';
type Cents = number;
export interface ProyeccionCuota { id: number; numeroPago: number; fecha: string; saldo: number; interes: number }
interface DistribucionCuota { id: number; numeroPago: number; fecha: string; saldoCents: Cents; interesCents: Cents }
export interface ProyeccionPrestamo { id: number; clienteId: number; cliente: string; estado: string; interesTotal: number; interesCobrado: number; interesPendiente: number; cuotasFuturas: number; totalCuotasFuturas: number; proyeccionFutura: number; proyeccionPeriodo: number; interesPendienteSinFecha: number; proximoPago: string | null; ultimoPagoProgramado: string | null; diferenciaValidacion: number; diferenciaProyeccion: number; cuotas: ProyeccionCuota[] }
export interface ProyeccionResponse { periodo: ProyeccionPeriodo; desdeFecha: string; hastaFecha: string | null; mensual: Array<{ mes: string; ganancia: number }>; prestamos: ProyeccionPrestamo[]; indicadores: { gananciaCobrado: number; gananciaPendiente: number; gananciaProyectadaPeriodo: number; ultimoPagoProgramado: string | null; interesPendienteSinFecha: number }; incobrable: { gananciaCobrado: number; gananciaPendiente: number; interesPendienteSinFecha: number; prestamos: Array<{ id: number; cliente: string; interesPendiente: number }> } }

export const toCents = (value: string | number | null | undefined): Cents => {
  const text = String(value ?? 0).trim();
  const negative = text.startsWith('-');
  const [whole = '0', fraction = ''] = (negative ? text.slice(1) : text).split('.');
  const cents = Number(whole || 0) * 100 + Number((fraction + '00').slice(0, 2));
  return (negative ? -1 : 1) * cents;
};
const money = (value: Cents) => value / 100;
const maxDate = (dates: string[]) => dates.length ? dates.reduce((max, date) => date > max ? date : max) : null;
const minDate = (dates: string[]) => dates.length ? dates.reduce((min, date) => date < min ? date : min) : null;
const monthOf = (date: string) => date.slice(0, 7);
const dateOnly = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
const isDateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

function addMonthsClamped(date: Date, months: number) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const day = date.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

function horizon(periodo: ProyeccionPeriodo, today: Date, maxActiveDate: string | null) {
  const from = dateOnly(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())));
  if (periodo === 'cartera') return { from, to: maxActiveDate };
  if (periodo === '15d') return { from, to: dateOnly(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 15))) };
  return { from, to: dateOnly(addMonthsClamped(today, Number(periodo[0]))) };
}

export function buildProyeccion(data: ProyeccionFinancieraData, periodo: ProyeccionPeriodo, today = new Date()): ProyeccionResponse {
  const active = data.prestamos.filter((loan) => loan.estado === 'ACTIVO');
  const bad = data.prestamos.filter((loan) => loan.estado === 'INCOBRABLE');
  const plans = new Map<number, ProyeccionPlanRow[]>();
  for (const plan of data.planes) plans.set(plan.prestamoId, [...(plans.get(plan.prestamoId) ?? []), plan]);
  const paidByPlan = new Map<number, Cents>();
  const interestByLoan = new Map<number, Cents>();
  for (const payment of data.pagos) {
    paidByPlan.set(payment.planPagoId, (paidByPlan.get(payment.planPagoId) ?? 0) + toCents(payment.monto));
    interestByLoan.set(payment.prestamoId, (interestByLoan.get(payment.prestamoId) ?? 0) + toCents(payment.interesAplicado));
  }
  const pendingDates = active.flatMap((loan) => plans.get(loan.id) ?? []).filter((plan) => isDateOnly(plan.fechaVencimiento) && toCents(plan.montoProgramado) - (paidByPlan.get(plan.id) ?? 0) > 0).map((plan) => plan.fechaVencimiento);
  const { from, to } = horizon(periodo, today, maxDate(pendingDates));
  const calculate = (loan: ProyeccionFinancieraData['prestamos'][number]): ProyeccionPrestamo => {
    const interesTotal = Math.max(0, toCents(loan.interes));
    const interesCobrado = Math.max(0, interestByLoan.get(loan.id) ?? 0);
    const interesPendiente = Math.max(interesTotal - interesCobrado, 0);
    const validPlans = (plans.get(loan.id) ?? []).map((plan) => ({ plan, saldoCents: Math.max(toCents(plan.montoProgramado) - (paidByPlan.get(plan.id) ?? 0), 0) })).filter((item) => item.saldoCents > 0 && isDateOnly(item.plan.fechaVencimiento)).sort((a, b) => a.plan.numeroPago - b.plan.numeroPago || a.plan.id - b.plan.id);
    const total = validPlans.reduce((sum, item) => sum + item.saldoCents, 0);
    let assigned = 0;
    const cuotas: DistribucionCuota[] = validPlans.map((item, index) => {
      const interesCents = index === validPlans.length - 1 ? interesPendiente - assigned : Math.floor(interesPendiente * item.saldoCents / total);
      assigned += interesCents;
      return { id: item.plan.id, numeroPago: item.plan.numeroPago, fecha: item.plan.fechaVencimiento, saldoCents: item.saldoCents, interesCents };
    });
    const projectedCents = cuotas.filter((quota) => quota.fecha >= from && (!to || quota.fecha <= to)).reduce((sum, quota) => sum + quota.interesCents, 0);
    const sinFechaCents = interesPendiente > 0 && !validPlans.length ? interesPendiente : 0;
    return { id: loan.id, clienteId: loan.clienteId, cliente: loan.cliente, estado: loan.estado, interesTotal: money(interesTotal), interesCobrado: money(interesCobrado), interesPendiente: money(interesPendiente), cuotasFuturas: cuotas.length, totalCuotasFuturas: money(total), proyeccionFutura: money(assigned), proyeccionPeriodo: money(projectedCents), interesPendienteSinFecha: money(sinFechaCents), proximoPago: minDate(cuotas.map((quota) => quota.fecha)), ultimoPagoProgramado: maxDate(cuotas.map((quota) => quota.fecha)), diferenciaValidacion: money(interesCobrado + interesPendiente - interesTotal), diferenciaProyeccion: money(assigned + sinFechaCents - interesPendiente), cuotas: cuotas.map((quota) => ({ id: quota.id, numeroPago: quota.numeroPago, fecha: quota.fecha, saldo: money(quota.saldoCents), interes: money(quota.interesCents) })) };
  };
  const loans = active.map(calculate);
  const monthlyMap = new Map<string, Cents>();
  for (const loan of loans) for (const quota of loan.cuotas) if (quota.fecha >= from && (!to || quota.fecha <= to)) monthlyMap.set(monthOf(quota.fecha), (monthlyMap.get(monthOf(quota.fecha)) ?? 0) + toCents(quota.interes));
  const mensual = [...monthlyMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, cents]) => ({ mes, ganancia: money(cents) }));
  const sum = (values: number[]) => values.reduce((total, value) => total + toCents(value), 0);
  const incobrable = bad.map(calculate);
  return { periodo, desdeFecha: from, hastaFecha: to, mensual, prestamos: loans, indicadores: { gananciaCobrado: money(sum(loans.map((loan) => loan.interesCobrado))), gananciaPendiente: money(sum(loans.map((loan) => loan.interesPendiente))), gananciaProyectadaPeriodo: money(sum(loans.map((loan) => loan.proyeccionPeriodo))), ultimoPagoProgramado: maxDate(loans.flatMap((loan) => loan.ultimoPagoProgramado ? [loan.ultimoPagoProgramado] : [])), interesPendienteSinFecha: money(sum(loans.map((loan) => loan.interesPendienteSinFecha))) }, incobrable: { gananciaCobrado: money(sum(incobrable.map((loan) => loan.interesCobrado))), gananciaPendiente: money(sum(incobrable.map((loan) => loan.interesPendiente))), interesPendienteSinFecha: money(sum(incobrable.map((loan) => loan.interesPendienteSinFecha))), prestamos: incobrable.map((loan) => ({ id: loan.id, cliente: loan.cliente, interesPendiente: loan.interesPendiente })) } };
}
