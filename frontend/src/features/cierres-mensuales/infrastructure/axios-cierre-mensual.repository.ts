import { apiClient } from '@/core/api/client'
import type { ClosingRepository, ClosingPreview, ClosingSnapshot } from '../domain/cierre-mensual.types'

export class AxiosCierreMensualRepository implements ClosingRepository {
  async preview(anio: number, mes: number): Promise<ClosingPreview> {
    return (await apiClient.get<ClosingPreview>('/cortes-mensuales/vista-previa', { params: { anio, mes } })).data
  }

  async list(): Promise<ClosingSnapshot[]> {
    return (await apiClient.get<ClosingSnapshot[]>('/cortes-mensuales')).data
  }

  async getById(id: number): Promise<ClosingSnapshot> {
    return (await apiClient.get<ClosingSnapshot>(`/cortes-mensuales/${id}`)).data
  }

  async close(input: { anio: number; mes: number; observaciones?: string }): Promise<ClosingSnapshot> {
    return (await apiClient.post<ClosingSnapshot>('/cortes-mensuales/cerrar', input)).data
  }
}
