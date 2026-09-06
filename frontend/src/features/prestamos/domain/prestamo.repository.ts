import type { PlanPago, Prestamo, PrestamoFilters, PrestamoInput, PrestamoPage } from './prestamo.types'

export interface PrestamoRepository {
  list(filters: PrestamoFilters): Promise<PrestamoPage>
  getById(id: number): Promise<Prestamo>
  create(input: PrestamoInput): Promise<Prestamo>
  getPaymentPlanPdf(id: number): Promise<Blob>
  getPaymentPlan(id: number): Promise<PlanPago[]>
  getAccountStatementPdf(id: number): Promise<Blob>
}
