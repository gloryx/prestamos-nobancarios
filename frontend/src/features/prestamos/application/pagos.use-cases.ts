import type { PagoRepository } from '../domain/pago.repository'
import type { Pago, PagoRegistrado, PagoResumen, RegistrarPagoInput } from '../domain/pago.types'

export const registrarPago = (repository: PagoRepository, input: RegistrarPagoInput): Promise<PagoRegistrado> => repository.create(input)

export const listarPagosDelPrestamo = (repository: PagoRepository, prestamoId: number): Promise<Pago[]> => repository.listByPrestamo(prestamoId)
export const obtenerResumenDelPrestamo = (repository: PagoRepository, prestamoId: number): Promise<PagoResumen> => repository.getSummaryByPrestamo(prestamoId)
