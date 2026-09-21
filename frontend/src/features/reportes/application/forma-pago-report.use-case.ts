import type { FormaPagoReportRepository } from '../domain/forma-pago-report.types'

export const obtenerReporteFormaPago = (repository: FormaPagoReportRepository, fechaDesde: string, fechaHasta: string) => repository.get(fechaDesde, fechaHasta)
