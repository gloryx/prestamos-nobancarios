import type { AnularPagoInput, Pago, PagoRegistrado, PagoResumen, PagosHistoryFilters, RegistrarPagoInput } from './pago.types'

export interface PagoRepository {
  create(input: RegistrarPagoInput): Promise<PagoRegistrado>
  listByPrestamo(prestamoId: number): Promise<Pago[]>
  getSummaryByPrestamo(prestamoId: number): Promise<PagoResumen>
  cancel(id: number, input: AnularPagoInput): Promise<void>
  exportPdf(filters: PagosHistoryFilters): Promise<{ blob: Blob; filename: string }>
}
