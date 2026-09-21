import { apiClient } from '@/core/api/client'
import type { FormaPagoReport, FormaPagoReportRepository } from '../domain/forma-pago-report.types'

export class AxiosFormaPagoReportRepository implements FormaPagoReportRepository {
  async get(fechaDesde: string, fechaHasta: string): Promise<FormaPagoReport> { return (await apiClient.get<FormaPagoReport>('/reportes/forma-pago', { params: { fechaDesde, fechaHasta } })).data }
}
