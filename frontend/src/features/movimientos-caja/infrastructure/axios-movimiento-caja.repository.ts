import { apiClient } from '@/core/api/client'
import type { CrearMovimientoCajaInput, MovimientoCajaFilters, MovimientoCajaRepository, MovimientoCaja, MovimientosCajaPage, MovimientosCajaSummary, EstadoCaja, ReversarMovimientoCajaInput } from '../domain/movimiento-caja.types'

export class AxiosMovimientoCajaRepository implements MovimientoCajaRepository {
  async list(filters: MovimientoCajaFilters & { pagina: number; limite: number }): Promise<MovimientosCajaPage> {
    const { conceptos, ...params } = filters
    return (await apiClient.get<MovimientosCajaPage>('/movimientos-caja', { params: { ...params, ...(conceptos?.length ? { conceptos: conceptos.join(',') } : {}) } })).data
  }

  async summary(filters: MovimientoCajaFilters): Promise<MovimientosCajaSummary> {
    return (await apiClient.get<MovimientosCajaSummary>('/movimientos-caja/resumen', { params: filters })).data
  }

  async getById(id: number): Promise<MovimientoCaja> {
    return (await apiClient.get<MovimientoCaja>(`/movimientos-caja/${id}`)).data
  }

  async obtenerEstado(fecha?: string): Promise<EstadoCaja> {
    return (await apiClient.get<EstadoCaja>('/movimientos-caja/estado', { params: fecha ? { fecha } : undefined })).data
  }

  async createManual(input: CrearMovimientoCajaInput, idempotencyKey: string): Promise<MovimientoCaja> {
    return (await apiClient.post<MovimientoCaja>('/movimientos-caja', input, { headers: { 'Idempotency-Key': idempotencyKey } })).data
  }

  async reverse(id: number, input: ReversarMovimientoCajaInput): Promise<MovimientoCaja> {
    return (await apiClient.post<MovimientoCaja>(`/movimientos-caja/${id}/reversar`, input)).data
  }
}
