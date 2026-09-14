import type { AnulacionesPage, AnularPrestamoInput, CambiarEstadoPrestamoInput, IncobrablesFilters, IncobrablesPage, PersonalizarPlanPagoInput, PersonalizarPlanPagoResponse, PlanPago, Prestamo, PrestamoExportFilters, PrestamoFilters, PrestamoInput, PrestamoPage, PrestamosResumen, PrestamoUpdateInput } from './prestamo.types'

export interface PrestamoRepository {
  list(filters: PrestamoFilters): Promise<PrestamoPage>
  summary(filters: PrestamoFilters): Promise<PrestamosResumen>
  exportarExcel(filters: PrestamoExportFilters): Promise<{ blob: Blob; filename?: string }>
  getById(id: number): Promise<Prestamo>
  create(input: PrestamoInput): Promise<Prestamo>
  update(id: number, input: PrestamoUpdateInput): Promise<Prestamo>
  cancel(id: number, input: AnularPrestamoInput): Promise<Prestamo>
  changeStatus(id: number, input: CambiarEstadoPrestamoInput): Promise<Prestamo>
  getPaymentPlanPdf(id: number): Promise<Blob>
  getPaymentPlan(id: number): Promise<PlanPago[]>
  adjustPaymentPlanAmount(id: number, montoProgramado?: number, fechaVencimiento?: string): Promise<{ actualizada: PlanPago; siguiente: PlanPago }>
  personalizePaymentPlan(id: number, input: PersonalizarPlanPagoInput): Promise<PersonalizarPlanPagoResponse>
  getAccountStatementPdf(id: number): Promise<Blob>
  listIncobrableCandidates(filters: IncobrablesFilters): Promise<IncobrablesPage>
  listIncobrables(filters: IncobrablesFilters): Promise<IncobrablesPage>
  listCancellationCandidates(filters: PrestamoFilters): Promise<PrestamoPage>
  listCancelled(filters: PrestamoFilters): Promise<AnulacionesPage>
}
