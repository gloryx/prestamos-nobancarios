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

export type PrestamoUpdateInput = Partial<Omit<PrestamoInput, 'cuotas'>>

export interface Prestamo {
  id: number
  clienteId: number
  periodicidadPagoId: number
  formaPagoId: number
  formaDesembolsoId: number | null
  fechaAlta: string
  capital: number
  capitalPendiente?: number
  saldoPendiente: number
  interes: number
  montoTotal: number
  montoDesembolsado: number
  cantidadPagos: number
  planPersonalizado: boolean
  observaciones: string | null
  cliente: { id: number; identificacion: string; nombreCompleto: string; direccion?: string | null; telefono?: string | null }
  periodicidadPago: { id: number; nombre: string }
  formaPago: { id: number; nombre: string }
  formaDesembolso: { id: number; nombre: string } | null
  estado: EstadoPrestamo
  fechaCreacion: string
  fechaActualizacion: string
  fechaLimiteContractual?: string | null
  fechaCancelacion?: string | null
  usuarioCancelacion?: { id: number; nombreCompleto: string } | null
  indicadorCobranza?: IndicadorCobranza | null
  puedeAnular: boolean
}

export type EstadoPrestamo = 'ACTIVO' | 'CANCELADO' | 'REFINANCIADO' | 'INCOBRABLE' | 'ANULADO'
export interface AnularPrestamoInput { fecha: string; observacion?: string }
export interface CambiarEstadoPrestamoInput { estado: 'ACTIVO' | 'INCOBRABLE'; fecha: string; observacion: string }
export type IndicadorCobranza = 'AL_DIA' | 'ATRASADO' | 'PLAZO_CUMPLIDO' | 'SALDADO'
export type PrestamoSortField = 'id' | 'cliente' | 'direccion' | 'fechaAlta' | 'fechaCancelacion' | 'capital' | 'saldoPendiente' | 'estado' | 'indicadorCobranza'
export type PrestamoSortDirection = 'ASC' | 'DESC'
export interface PrestamoFilters { pagina: number; limite: number; buscar?: string; direccion?: string; estados?: EstadoPrestamo[]; indicadorCobranza?: IndicadorCobranza; fechaInicio?: string; fechaFin?: string; fechaCancelacionDesde?: string; fechaCancelacionHasta?: string; estado?: EstadoPrestamo; clienteId?: number; ordenarPor?: PrestamoSortField; direccionOrden?: PrestamoSortDirection }
export type PrestamoExportFilters = Pick<PrestamoFilters, 'buscar' | 'direccion' | 'estados' | 'fechaInicio' | 'fechaFin'>
export interface PrestamoPage { datos: Prestamo[]; pagina: number; limite: number; total: number; totalPaginas: number }
export interface IncobrableLoan extends Prestamo { fechaVencimiento?: string; saldoCuota?: number; fechaIncobrable?: string; observacionIncobrable?: string | null; diasEnEstado?: number; ultimaFechaPago?: string | null; puedePasarAIncobrable: boolean; puedeReactivar: boolean }
export interface IncobrablesPage { datos: IncobrableLoan[]; pagina: number; limite: number; total: number; totalPaginas: number }
export interface AnuladoLoan extends Prestamo { fechaAnulacion: string; observacionAnulacion: string | null; movimientoDesembolsoId: number | null; movimientoReversoId: number | null; fechaReverso: string | null; montoReversado: number | null; usuarioAnulacion: { id: number; nombreCompleto: string } | null }
export interface AnulacionesPage { datos: AnuladoLoan[]; pagina: number; limite: number; total: number; totalPaginas: number }
export type IncobrablesSortField = 'fechaVencimiento' | 'saldoPendiente' | 'cliente' | 'fechaIncobrable' | 'id'
export interface IncobrablesFilters { pagina: number; limite: number; buscar?: string; direccion?: string; fechaReferencia?: string; ordenarPor?: IncobrablesSortField; direccionOrden?: 'ASC' | 'DESC' }
export interface PrestamosResumen { total: number; prestado: number; ganancia: number; recuperado: number; pendiente: number }
export type EstadoCuota = 'PENDIENTE' | 'PAGADA'
export interface PlanPago { id: number; prestamoId: number; numeroPago: number; fechaVencimiento: string; montoProgramado: number; fechaCreacion: string; montoPagado: number; montoPendiente: number; estado: EstadoCuota; fechasPago: string[]; protegida?: boolean; editable?: boolean; puedeEditarFecha?: boolean; puedeEditarMonto?: boolean; eliminable?: boolean }

export interface PersonalizarPlanPagoCuotaInput { id?: number; numeroPago?: number; fechaVencimiento: string; montoProgramado?: number }
export interface PersonalizarPlanPagoInput { cuotas: PersonalizarPlanPagoCuotaInput[] }
export interface PersonalizarPlanPagoResponse { saldoPendiente: number; totalPlanOperativoPendiente: number; cuotas: PlanPago[] }
