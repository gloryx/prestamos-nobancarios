export type MovimientoTipo = 'ENTRADA' | 'SALIDA'
export type MovimientoConcepto = 'PAGO_CLIENTE' | 'DESEMBOLSO_PRESTAMO' | 'DESEMBOLSO_REFINANCIAMIENTO' | 'APORTE_CAPITAL' | 'RETIRO' | 'GASTO' | 'AJUSTE_ENTRADA' | 'AJUSTE_SALIDA' | 'REVERSO'

export interface MovimientoCaja {
  id: number
  tipo: MovimientoTipo
  concepto: MovimientoConcepto
  monto: number
  fecha: string
  fechaCreacion?: string
  observaciones?: string | null
  pagoId?: number | null
  formaPagoId?: number | null
  prestamoId?: number | null
  refinanciamientoId?: number | null
  movimientoReversadoId?: number | null
  usuarioId: number
  formaPago?: { id: number; nombre: string }
  usuario?: { id: number; nombreCompleto: string; activo: boolean }
  movimientoReversado?: { id: number; concepto: MovimientoConcepto; monto: number }
  reversiones?: Array<{ id: number; tipo: MovimientoTipo; monto: number; fecha: string }>
}

export interface MovimientoCajaFilters {
  fechaDesde?: string
  fechaHasta?: string
  tipo?: MovimientoTipo
  concepto?: MovimientoConcepto
  conceptos?: MovimientoConcepto[]
  buscar?: string
}

export interface MovimientosCajaPage {
  datos: MovimientoCaja[]
  pagina: number
  limite: number
  total: number
  totalPaginas: number
}

export interface MovimientosCajaSummary {
  totalEntradas: number
  totalSalidas: number
  balanceNeto: number
}

export type OrigenSaldoCaja = 'APERTURA' | 'ULTIMO_CIERRE'

export interface EstadoCajaDesglose {
  total: number
  pagosClientes: number
  aportesCapital: number
  ajustes: number
  desembolsosPrestamos: number
  desembolsosRefinanciamientos: number
  retiros: number
  gastos: number
  reversos: number
  otros: number
}

export interface EstadoCaja {
  fechaConsulta: string
  fechaApertura: string
  origenSaldo: OrigenSaldoCaja
  fechaOrigen: string
  disponibleOrigen: number
  entradas: EstadoCajaDesglose
  salidas: EstadoCajaDesglose
  flujoNeto: number
  disponible: number
  cantidadMovimientos: number
}

export interface MovimientoCajaRepository {
  list(filters: MovimientoCajaFilters & { pagina: number; limite: number }): Promise<MovimientosCajaPage>
  summary(filters: MovimientoCajaFilters): Promise<MovimientosCajaSummary>
  getById(id: number): Promise<MovimientoCaja>
  obtenerEstado(fecha?: string): Promise<EstadoCaja>
  createManual(input: CrearMovimientoCajaInput, idempotencyKey: string): Promise<MovimientoCaja>
  reverse(id: number, input: ReversarMovimientoCajaInput): Promise<MovimientoCaja>
}

export type ConceptoMovimientoManual = 'APORTE_CAPITAL' | 'RETIRO' | 'GASTO' | 'AJUSTE_ENTRADA' | 'AJUSTE_SALIDA'

export interface CrearMovimientoCajaInput {
  concepto: ConceptoMovimientoManual
  monto: number
  fecha: string
  formaPagoId?: number
  observaciones?: string
}

export interface ReversarMovimientoCajaInput {
  fecha: string
  observaciones: string
}
