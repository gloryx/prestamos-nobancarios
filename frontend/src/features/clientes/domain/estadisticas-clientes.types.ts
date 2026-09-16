export type EstadisticasClientesOrden = 'cantidadPrestamos' | 'totalPrestado' | 'gananciaCobrada'
export type EstadisticasClientesTop = '10' | '20' | '50' | 'todos'

export interface EstadisticaClienteRow {
  posicion: number
  clienteId: number
  cliente: string
  identificacion: string
  cantidadPrestamos: number
  totalPrestado: number
  gananciaCobrada: number
  antiguedad: string
}

export interface EstadisticasClientesResponse {
  orden: EstadisticasClientesOrden
  top: EstadisticasClientesTop
  datos: EstadisticaClienteRow[]
}

export interface EstadisticasClientesRepository {
  get(orden: EstadisticasClientesOrden, top: EstadisticasClientesTop): Promise<EstadisticasClientesResponse>
}
