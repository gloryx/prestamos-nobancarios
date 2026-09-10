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
}

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
