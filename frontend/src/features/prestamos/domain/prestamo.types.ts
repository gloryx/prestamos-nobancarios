export interface CuotaPrestamoInput {
  numeroPago: number
  fechaVencimiento: string
  montoProgramado: number
}

export interface PrestamoInput {
  clienteId: number
  periodicidadPagoId: number
  formaPagoId: number
  formaDesembolsoId: number
  fechaAlta: string
  capital: number
  interes: number
  cantidadPagos: number
  planPersonalizado: boolean
  observaciones?: string
  cuotas?: CuotaPrestamoInput[]
}

export interface Prestamo {
  id: number
  clienteId: number
  periodicidadPagoId: number
  formaPagoId: number
  formaDesembolsoId: number | null
  fechaAlta: string
  capital: number
  capitalPendiente?: number
  interes: number
  montoTotal: number
  montoDesembolsado: number
  cantidadPagos: number
  planPersonalizado: boolean
  observaciones: string | null
  cliente: { id: number; identificacion: string; nombreCompleto: string; direccion?: string | null }
  estado: EstadoPrestamo
  fechaCreacion: string
  fechaActualizacion: string
  fechaLimiteContractual: string
  indicadorCobranza: IndicadorCobranza
}

export type EstadoPrestamo = 'ACTIVO' | 'CANCELADO' | 'REFINANCIADO' | 'INCOBRABLE'
export type IndicadorCobranza = 'AL_DIA' | 'ATRASADO' | 'PLAZO_CUMPLIDO' | 'SALDADO'
export type PrestamoSortField = 'id' | 'cliente' | 'direccion' | 'fechaAlta' | 'capital' | 'estado'
export type PrestamoSortDirection = 'ASC' | 'DESC'
export interface PrestamoFilters { pagina: number; limite: number; buscar?: string; direccion?: string; estados?: EstadoPrestamo[]; indicadorCobranza?: IndicadorCobranza; fechaInicio?: string; fechaFin?: string; estado?: EstadoPrestamo; clienteId?: number; ordenarPor?: PrestamoSortField; direccionOrden?: PrestamoSortDirection }
export type PrestamoExportFilters = Pick<PrestamoFilters, 'buscar' | 'direccion' | 'estados' | 'fechaInicio' | 'fechaFin'>
export interface PrestamoPage { datos: Prestamo[]; pagina: number; limite: number; total: number; totalPaginas: number }
export interface PrestamosResumen { total: number; prestado: number; ganancia: number; recuperado: number; pendiente: number }
export type EstadoCuota = 'PENDIENTE' | 'PARCIAL' | 'PAGADA'
export interface PlanPago { id: number; prestamoId: number; numeroPago: number; fechaVencimiento: string; montoProgramado: number; fechaCreacion: string; montoPagado: number; montoPendiente: number; estado: EstadoCuota; fechasPago: string[] }
