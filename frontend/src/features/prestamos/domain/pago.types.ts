export interface Pago {
  id: number
  prestamoId: number
  formaPagoId: number
  monto: number
  capitalAplicado: number
  interesAplicado: number
  cobradorId: number
  fecha: string
  observaciones: string | null
  fechaCreacion: string
  formaPago?: { id: number; nombre: string } | null
  cobrador?: { id: number; identificacion: string; nombreCompleto: string; telefono: string; correo: string } | null
  planPagoId?: number | null
  numeroCuota?: number | null
  formaPagoNombre?: string | null
  estado?: 'REGISTRADO' | 'ANULADO' | string
  puedeAnular?: boolean
  anulacion?: { motivo: string; observacion?: string | null; fecha?: string | null } | null
  fechaVencimiento?: string | null
  usuarioAnulacion?: { id: number; nombreCompleto: string } | null
  cliente?: { id: number; identificacion?: string; nombreCompleto?: string; telefono1?: string | null; telefono2?: string | null } | null
  prestamo?: { id: number; estado: string } | null
}

export interface PagosTotales { cantidadPagos: number; totalRecibido: number; capitalAplicado: number; interesAplicado: number }
export interface PagosPage { datos: Pago[]; pagina: number; limite: number; total: number; totalPaginas: number; totales: PagosTotales }
export interface PagosHistoryFilters { pagina: number; limite: number; fechaDesde?: string; fechaHasta?: string; buscar?: string; prestamoId?: number; estado?: 'REGISTRADO' | 'ANULADO' | 'TODOS'; formaPagoId?: number; cobradorId?: number }

export interface AnularPagoInput {
  motivo: string
  observacion?: string
}

export interface PagoResumen {
  prestamoId: number
  capitalOriginal: number
  interesOriginal: number
  montoTotal: number
  totalPagado: number
  capitalPagado: number
  interesPagado: number
  capitalPendiente: number
  interesPendiente: number
  saldoPendiente: number
  estado: string
}

export interface RegistrarPagoInput {
  prestamoId: number
  formaPagoId: number
  monto: number
  fecha: string
  cobradorId: number
  planPagoId: number
  observaciones?: string | null
}

export interface PagoRegistrado extends Pago {
  prestamo?: { id: number; estado: string } | null
}
