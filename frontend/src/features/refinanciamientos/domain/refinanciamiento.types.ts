import type { CuotaPrestamoInput, Prestamo, PrestamoFilters, PrestamoPage } from '@/features/prestamos/domain/prestamo.types'

export interface RefinanciamientoPreview {
  elegible: boolean
  motivo: string | null
  cliente: { id: number; identificacion: string; nombreCompleto: string }
  prestamo: { id: number; estado: string; fechaAlta: string; capital: number; interes: number; montoTotal: number }
  totalPagado: number
  interesRequerido: number
  interesPendienteParaRefinanciar: number
  capitalAmortizadoRefinanciamiento: number
  capitalPendienteRefinanciable: number
}

export interface CrearRefinanciamientoInput {
  prestamoOrigenId: number
  periodicidadPagoId: number
  formaPagoId: number
  formaDesembolsoId?: number | null
  fecha: string
  montoNuevoDesembolsado: number
  interesNuevo: number
  cantidadPagos: number
  planPersonalizado: boolean
  cuotas?: CuotaPrestamoInput[]
  observaciones?: string
}

export interface RefinanciamientoResponse {
  id: number
  prestamoOrigenId: number
  prestamoNuevoId: number
  capitalPendiente: number
  montoRefinanciado: number
  interesNuevo: number
  nuevaOperacion: { dineroNuevoDesembolsado: number; interesNuevo: number }
  composicion: { capitalTotalNuevo: number; interesTotalNuevo: number; capitalAnteriorPendiente?: number; dineroNuevoDesembolsado?: number }
  prestamoNuevo?: Prestamo | Record<string, unknown>
  prestamoOrigen?: Prestamo | Record<string, unknown>
  planNuevo?: unknown[]
}

export interface RefinanciamientoRepository {
  preview(prestamoId: number): Promise<RefinanciamientoPreview>
  create(input: CrearRefinanciamientoInput): Promise<RefinanciamientoResponse>
}

export type ActiveLoanRepository = { list(filters: PrestamoFilters): Promise<PrestamoPage> }
