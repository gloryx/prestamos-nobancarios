export const FORMA_PAGO_REPORT_REPOSITORY = Symbol('FORMA_PAGO_REPORT_REPOSITORY');

export interface FormaPagoReportRow {
  formaPagoId: number;
  formaPagoNombre: string;
  cantidad: string | number;
  monto: string | number;
}

export interface FormaPagoReportUnclassifiedRow {
  monto: string | number;
  cantidad: string | number;
}

export interface FormaPagoReportRepository {
  desembolsos(fechaDesde: string, fechaHasta: string): Promise<FormaPagoReportRow[]>;
  pagos(fechaDesde: string, fechaHasta: string): Promise<FormaPagoReportRow[]>;
  desembolsosSinForma(fechaDesde: string, fechaHasta: string): Promise<FormaPagoReportUnclassifiedRow>;
}
