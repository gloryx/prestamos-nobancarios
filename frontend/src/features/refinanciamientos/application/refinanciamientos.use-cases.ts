import type { ActiveLoanRepository, CrearRefinanciamientoInput, RefinanciamientoListFilters, RefinanciamientoReportFilters, RefinanciamientoRepository } from '../domain/refinanciamiento.types'

export const listarRefinanciamientos = (repository: RefinanciamientoRepository, filters: RefinanciamientoListFilters) => repository.list(filters)
export const obtenerReporteRefinanciamientos = (repository: RefinanciamientoRepository, filters: RefinanciamientoReportFilters) => repository.report(filters)

export const previsualizarRefinanciamiento = (repository: RefinanciamientoRepository, prestamoId: number) => repository.preview(prestamoId)
export const crearRefinanciamiento = (repository: RefinanciamientoRepository, input: CrearRefinanciamientoInput) => repository.create(input)
export const obtenerDetalleRefinanciamiento = (repository: RefinanciamientoRepository, id: number) => repository.detail(id)
export const obtenerRefinanciamientoPorOrigen = (repository: RefinanciamientoRepository, id: number) => repository.byOriginLoan(id)
export const obtenerRefinanciamientoPorNuevo = (repository: RefinanciamientoRepository, id: number) => repository.byNewLoan(id)
export const listarPrestamosActivosParaRefinanciar = (repository: ActiveLoanRepository, pagina: number, buscar: string, limite = 10) => {
  const filters: { pagina: number; limite: number; buscar?: string } = { pagina, limite }
  if (buscar.trim()) filters.buscar = buscar.trim()
  return repository.listEligible(filters)
}

export function refinanciamientoErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') return (error as { message: string }).message
  return 'No se pudo completar la operación. Intenta nuevamente.'
}
