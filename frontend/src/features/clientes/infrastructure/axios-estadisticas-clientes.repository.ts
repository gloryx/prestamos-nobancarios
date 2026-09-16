import { apiClient } from '@/core/api/client'
import type { EstadisticasClientesOrden, EstadisticasClientesRepository, EstadisticasClientesResponse, EstadisticasClientesTop } from '../domain/estadisticas-clientes.types'

export class AxiosEstadisticasClientesRepository implements EstadisticasClientesRepository {
  async get(orden: EstadisticasClientesOrden, top: EstadisticasClientesTop): Promise<EstadisticasClientesResponse> {
    return (await apiClient.get<EstadisticasClientesResponse>('/reportes/clientes/estadisticas', { params: { orden, top } })).data
  }
}
