import axios from 'axios'
import { apiClient } from '@/core/api/client'
import { PeriodicidadError } from '../domain/periodicidad-pago.error'
import type { Periodicidad, PeriodicidadInput, PeriodicidadRepository } from '../domain/periodicidad-pago.types'

function rethrow(error: unknown): never {
  if (axios.isAxiosError(error)) throw new PeriodicidadError(error.response?.status ?? 0, 'periodicidad request failed')
  throw error
}

export class AxiosPeriodicidadRepository implements PeriodicidadRepository {
  async list(): Promise<Periodicidad[]> {
    try { return (await apiClient.get<Periodicidad[]>('/periodicidades-pago')).data } catch (error) { return rethrow(error) }
  }

  async getById(id: number): Promise<Periodicidad> {
    try { return (await apiClient.get<Periodicidad>(`/periodicidades-pago/${id}`)).data } catch (error) { return rethrow(error) }
  }

  async create(input: PeriodicidadInput): Promise<Periodicidad> {
    try { return (await apiClient.post<Periodicidad>('/periodicidades-pago', input)).data } catch (error) { return rethrow(error) }
  }

  async update(id: number, input: PeriodicidadInput): Promise<Periodicidad> {
    try { return (await apiClient.put<Periodicidad>(`/periodicidades-pago/${id}`, input)).data } catch (error) { return rethrow(error) }
  }

  async changeStatus(id: number, activo: boolean): Promise<Periodicidad> {
    try { return (await apiClient.patch<Periodicidad>(`/periodicidades-pago/${id}/estado`, { activo })).data } catch (error) { return rethrow(error) }
  }
}
