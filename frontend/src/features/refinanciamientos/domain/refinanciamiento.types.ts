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

export interface RefinanciamientoListFilters {
  pagina: number
  limite: number
  buscar?: string
  clienteId?: number
  fechaDesde?: string
  fechaHasta?: string
}

export interface RefinanciamientoListado {
  id: number
  prestamoOrigenId: number
  prestamoNuevoId: number
  fecha: string
  capitalPendiente: number
  interesNuevo: number
  fechaLimiteContractualOrigen: string | null
  diasGanados: number | null
  cliente: { id: number; identificacion: string; nombreCompleto: string }
  prestamoOrigen?: { id: number; [key: string]: unknown }
  prestamoNuevo?: { id: number; capital: number; montoDesembolsado?: number; [key: string]: unknown }
  nuevaOperacion?: { dineroNuevoDesembolsado?: number; [key: string]: unknown }
  composicion?: { dineroNuevoDesembolsado?: number; [key: string]: unknown }
}

export interface RefinanciamientoPage {
  datos: RefinanciamientoListado[]
  pagina: number
  limite: number
  total: number
  totalPaginas: number
}

export interface RefinanciamientoRepository {
  list(filters: RefinanciamientoListFilters): Promise<RefinanciamientoPage>
  preview(prestamoId: number): Promise<RefinanciamientoPreview>
  create(input: CrearRefinanciamientoInput): Promise<RefinanciamientoResponse>
}

export type ActiveLoanRepository = { list(filters: PrestamoFilters): Promise<PrestamoPage> }
