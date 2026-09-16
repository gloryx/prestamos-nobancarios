import type { EstadisticasClientesOrden, EstadisticasClientesRepository, EstadisticasClientesTop } from '../domain/estadisticas-clientes.types'

export function obtenerEstadisticasClientes(repository: EstadisticasClientesRepository, orden: EstadisticasClientesOrden, top: EstadisticasClientesTop) {
  return repository.get(orden, top)
}
