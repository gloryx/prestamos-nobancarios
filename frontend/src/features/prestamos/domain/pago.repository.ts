import type { Pago, PagoRegistrado, PagoResumen, RegistrarPagoInput } from './pago.types'

export interface PagoRepository {
  create(input: RegistrarPagoInput): Promise<PagoRegistrado>
  listByPrestamo(prestamoId: number): Promise<Pago[]>
  getSummaryByPrestamo(prestamoId: number): Promise<PagoResumen>
}
