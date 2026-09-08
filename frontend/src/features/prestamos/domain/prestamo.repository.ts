import type { PlanPago, Prestamo, PrestamoExportFilters, PrestamoFilters, PrestamoInput, PrestamoPage, PrestamosResumen } from './prestamo.types'

export interface PrestamoRepository {
  list(filters: PrestamoFilters): Promise<PrestamoPage>
  summary(filters: PrestamoFilters): Promise<PrestamosResumen>
  exportarExcel(filters: PrestamoExportFilters): Promise<{ blob: Blob; filename?: string }>
  getById(id: number): Promise<Prestamo>
  create(input: PrestamoInput): Promise<Prestamo>
  getPaymentPlanPdf(id: number): Promise<Blob>
  getPaymentPlan(id: number): Promise<PlanPago[]>
  adjustPaymentPlanAmount(id: number, montoProgramado?: number, fechaVencimiento?: string): Promise<{ actualizada: PlanPago; siguiente: PlanPago }>
  getAccountStatementPdf(id: number): Promise<Blob>
}
