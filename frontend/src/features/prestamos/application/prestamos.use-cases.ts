import type { PlanPago, Prestamo, PrestamoFilters, PrestamoInput, PrestamoPage } from '../domain/prestamo.types'
import type { PrestamoRepository } from '../domain/prestamo.repository'

export const crearPrestamo = (repository: PrestamoRepository, input: PrestamoInput): Promise<Prestamo> => repository.create(input)
export const listarPrestamos = (repository: PrestamoRepository, filters: PrestamoFilters): Promise<PrestamoPage> => repository.list(filters)
export const obtenerPrestamo = (repository: PrestamoRepository, id: number): Promise<Prestamo> => repository.getById(id)
export const listarPlanPago = (repository: PrestamoRepository, id: number): Promise<PlanPago[]> => repository.getPaymentPlan(id)

export async function abrirPlanPagoPdf(repository: PrestamoRepository, id: number): Promise<void> {
  const blob = await repository.getPaymentPlanPdf(id)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.target = '_blank'
  link.rel = 'noopener'
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
export async function abrirEstadoCuentaPdf(repository: PrestamoRepository, id: number): Promise<void> {
  const blob = await repository.getAccountStatementPdf(id)
  const url = URL.createObjectURL(blob); window.open(url, '_blank', 'noopener,noreferrer'); window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
