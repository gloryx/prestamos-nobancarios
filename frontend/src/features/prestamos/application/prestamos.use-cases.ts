import type { AnulacionesPage, AnularPrestamoInput, CambiarEstadoPrestamoInput, IncobrablesFilters, IncobrablesPage, PersonalizarPlanPagoInput, PersonalizarPlanPagoResponse, PlanPago, Prestamo, PrestamoExportFilters, PrestamoFilters, PrestamoInput, PrestamoPage, PrestamosResumen, PrestamoUpdateInput } from '../domain/prestamo.types'
import type { PrestamoRepository } from '../domain/prestamo.repository'

export const crearPrestamo = (repository: PrestamoRepository, input: PrestamoInput): Promise<Prestamo> => repository.create(input)
export const actualizarPrestamo = (repository: PrestamoRepository, id: number, input: PrestamoUpdateInput): Promise<Prestamo> => repository.update(id, input)
export const anularPrestamo = (repository: PrestamoRepository, id: number, input: AnularPrestamoInput): Promise<Prestamo> => repository.cancel(id, input)
export const cambiarEstadoPrestamo = (repository: PrestamoRepository, id: number, input: CambiarEstadoPrestamoInput): Promise<Prestamo> => repository.changeStatus(id, input)
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
export const personalizarPlanPago = (repository: PrestamoRepository, id: number, input: PersonalizarPlanPagoInput): Promise<PersonalizarPlanPagoResponse> => repository.personalizePaymentPlan(id, input)
export const listarCandidatosIncobrables = (repository: PrestamoRepository, filters: IncobrablesFilters): Promise<IncobrablesPage> => repository.listIncobrableCandidates(filters)
export const listarIncobrables = (repository: PrestamoRepository, filters: IncobrablesFilters): Promise<IncobrablesPage> => repository.listIncobrables(filters)
export const listarCandidatosAnulacion = (repository: PrestamoRepository, filters: PrestamoFilters): Promise<PrestamoPage> => repository.listCancellationCandidates(filters)
export const listarAnulados = (repository: PrestamoRepository, filters: PrestamoFilters): Promise<AnulacionesPage> => repository.listCancelled(filters)

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
