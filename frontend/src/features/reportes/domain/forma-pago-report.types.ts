export interface FormaPagoReportRow { formaPagoId: number | null; formaPagoNombre: string; cantidad: number; monto: number }
export interface FormaPagoReport { fechaDesde: string; fechaHasta: string; resumen: { totalDesembolsado: number; totalRecibido: number; diferencia: number; movimientosDesembolsoSinForma: number; montoDesembolsoSinForma: number }; desembolsos: FormaPagoReportRow[]; pagos: FormaPagoReportRow[] }
export interface FormaPagoReportRepository { get(fechaDesde: string, fechaHasta: string): Promise<FormaPagoReport> }
