export type HistoricalPayment = {
  fecha: string;
  estado?: string;
  interesAplicado?: number;
  anulacionFecha?: string | null;
};

/** A payment is valid at a civil-date cutoff when it existed and had not been annulled yet. */
export const isPaymentValidAt = (payment: HistoricalPayment, fechaCorte: string) =>
  payment.fecha <= fechaCorte &&
  (payment.estado !== 'ANULADO' || (!!payment.anulacionFecha && payment.anulacionFecha > fechaCorte));

export const sumHistoricalInterest = (payments: HistoricalPayment[], fechaCorte: string) =>
  payments.filter(payment => isPaymentValidAt(payment, fechaCorte))
    .reduce((sum, payment) => sum + Number(payment.interesAplicado ?? 0), 0);
