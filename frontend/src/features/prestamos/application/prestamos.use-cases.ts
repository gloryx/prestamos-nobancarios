import type { PlanPago, Prestamo, PrestamoExportFilters, PrestamoFilters, PrestamoInput, PrestamoPage, PrestamosResumen } from '../domain/prestamo.types'
import type { PrestamoRepository } from '../domain/prestamo.repository'

export const crearPrestamo = (repository: PrestamoRepository, input: PrestamoInput): Promise<Prestamo> => repository.create(input)
export const listarPrestamos = (repository: PrestamoRepository, filters: PrestamoFilters): Promise<PrestamoPage> => repository.list(filters)
export const resumirPrestamos = (repository: PrestamoRepository, filters: PrestamoFilters): Promise<PrestamosResumen> => repository.summary(filters)
export async function descargarPrestamosExcel(repository: PrestamoRepository, filters: PrestamoExportFilters): Promise<void> {
  const result = await repository.exportarExcel(filters)
  const url = URL.createObjectURL(result.blob)
  const link = document.createElement('a')
  link.href = url
  link.download = result.filename ?? `Prestamos_Filtrados_${new Date().toISOString().slice(0, 10).split('-').reverse().join('-')}.xlsx`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
export const obtenerPrestamo = (repository: PrestamoRepository, id: number): Promise<Prestamo> => repository.getById(id)
export const listarPlanPago = (repository: PrestamoRepository, id: number): Promise<PlanPago[]> => repository.getPaymentPlan(id)
export const ajustarMontoCuota = (repository: PrestamoRepository, id: number, montoProgramado?: number, fechaVencimiento?: string) => repository.adjustPaymentPlanAmount(id, montoProgramado, fechaVencimiento)

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
