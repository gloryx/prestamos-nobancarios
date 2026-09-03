export interface DistribucionPago { capital: number; interes: number; }

export class DistribuidorPagoService {
  static distribuir(monto: number, capitalPendiente: number, interesPendiente: number): DistribucionPago {
    const cents = (value: number) => Math.round(value * 100);
    const payment = cents(monto); const capital = cents(capitalPendiente); const interest = cents(interesPendiente);
    if (payment <= 0) throw new Error('El monto del pago debe ser mayor que cero.');
    if (payment > capital + interest) throw new Error('El monto del pago no puede ser mayor al saldo pendiente del préstamo.');
    const capitalApplied = Math.min(payment, capital);
    const distribution = { capital: capitalApplied / 100, interes: (payment - capitalApplied) / 100 };
    if (cents(distribution.capital) + cents(distribution.interes) !== payment) throw new Error('La distribución del pago es inválida.');
    return distribution;
  }
}
