export interface Pago {
  id: number
  prestamoId: number
  formaPagoId: number
  monto: number
  capitalAplicado: number
  interesAplicado: number
  cobradorId: number | null
  fecha: string
  observaciones: string | null
  fechaCreacion: string
  formaPago?: { id: number; nombre: string } | null
  cobrador?: { id: number; identificacion: string; nombreCompleto: string; telefono: string; correo: string } | null
  planPagoId?: number | null
  numeroCuota?: number | null
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
  observaciones?: string
}

export interface PagoRegistrado extends Pago {
  prestamo?: { id: number; estado: string } | null
}
