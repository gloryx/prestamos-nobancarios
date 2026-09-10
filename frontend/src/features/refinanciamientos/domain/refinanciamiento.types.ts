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
  report(filters: RefinanciamientoReportFilters): Promise<RefinanciamientoReportResponse>
  preview(prestamoId: number): Promise<RefinanciamientoPreview>
  create(input: CrearRefinanciamientoInput): Promise<RefinanciamientoResponse>
}

export interface RefinanciamientoReportFilters {
  buscar?: string
  clienteId?: number
  fechaDesde?: string
  fechaHasta?: string
}

export interface RefinanciamientoReportDetail {
  id: number
  fecha: string
  cliente: { id: number; identificacion: string; nombreCompleto: string }
  prestamoOrigenId: number
  capitalTrasladado: number
  dineroNuevoDesembolsado: number
  capitalNuevo: number
  interesNuevo: number
  diasGanados: number | null
  prestamoNuevoId: number
}

export interface RefinanciamientoReportSummary {
  cantidadRefinanciamientos: number
  cantidadClientes: number
  totalCapitalTrasladado: number
  totalDineroNuevoDesembolsado: number
  totalCapitalNuevo: number
  totalInteresNuevoPactado: number
  refinanciamientosConDineroNuevo: number
  refinanciamientosSinDineroNuevo: number
  refinanciamientosAnticipados: number
  refinanciamientosSinAnticipacion: number
  promedioDiasGanados: number | null
  diasGanadosCompletos: boolean
}

export interface RefinanciamientoReportResponse {
  filtros: { buscar: string | null; clienteId: number | null; fechaDesde: string | null; fechaHasta: string | null }
  resumen: RefinanciamientoReportSummary
  datos: RefinanciamientoReportDetail[]
}

export type ActiveLoanRepository = { list(filters: PrestamoFilters): Promise<PrestamoPage> }
