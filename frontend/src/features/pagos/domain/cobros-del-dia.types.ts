export interface CobroDelDia {
  planPagoId: number
  numeroPago: number
  fecha: string
  montoProgramado: number
  montoPagado: number
  estado: 'PAGADO' | 'PENDIENTE'
  prestamoId: number
  capital: number
  saldoActual: number
  estadoPrestamo: string
  periodicidad: string
  clienteId: number
  nombreCompleto: string
  identificacion: string
  telefonoPrincipal: string
  direccion: string | null
  formaPagoId: number
  formaPagoNombre: string
  cobradorId: number | null
  cobradorNombre: string | null
}

export interface CobrosDelDiaResponse {
  fecha: string | null
  fechaDesde: string | null
  fechaHasta: string | null
  filas: CobroDelDia[]
  totales: {
    cantidadProgramados: number
    cantidadPagados: number
    cantidadPendientes: number
    montoProgramado: number
    montoRecibido: number
  }
}
