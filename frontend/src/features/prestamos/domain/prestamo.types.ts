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
}

export type EstadoPrestamo = 'ACTIVO' | 'CANCELADO' | 'REFINANCIADO' | 'INCOBRABLE'
export interface PrestamoFilters { pagina: number; limite: number; buscar?: string; direccion?: string; estado?: EstadoPrestamo; clienteId?: number }
export interface PrestamoPage { datos: Prestamo[]; pagina: number; limite: number; total: number; totalPaginas: number }
export type EstadoCuota = 'PENDIENTE' | 'PARCIAL' | 'PAGADA'
export interface PlanPago { id: number; prestamoId: number; numeroPago: number; fechaVencimiento: string; montoProgramado: number; fechaCreacion: string; montoPagado: number; montoPendiente: number; estado: EstadoCuota; fechasPago: string[] }
