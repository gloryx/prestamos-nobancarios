import type { PrestamoFilters } from '@/features/prestamos/domain/prestamo.types'
import type { ActiveLoanRepository, CrearRefinanciamientoInput, RefinanciamientoListFilters, RefinanciamientoRepository } from '../domain/refinanciamiento.types'

export const listarRefinanciamientos = (repository: RefinanciamientoRepository, filters: RefinanciamientoListFilters) => repository.list(filters)

export const previsualizarRefinanciamiento = (repository: RefinanciamientoRepository, prestamoId: number) => repository.preview(prestamoId)
export const crearRefinanciamiento = (repository: RefinanciamientoRepository, input: CrearRefinanciamientoInput) => repository.create(input)
export const listarPrestamosActivosParaRefinanciar = (repository: ActiveLoanRepository, pagina: number, buscar: string, limite = 10) => {
  const filters: PrestamoFilters = { pagina, limite, estados: ['ACTIVO'] }
  if (buscar.trim()) filters.buscar = buscar.trim()
  return repository.list(filters)
}

export function refinanciamientoErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') return (error as { message: string }).message
  return 'No se pudo completar la operación. Intenta nuevamente.'
}
