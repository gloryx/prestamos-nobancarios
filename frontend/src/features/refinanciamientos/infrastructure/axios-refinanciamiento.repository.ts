import axios from 'axios'
import { apiClient } from '@/core/api/client'
import type { CrearRefinanciamientoInput, RefinanciamientoListFilters, RefinanciamientoPage, RefinanciamientoPreview, RefinanciamientoRepository, RefinanciamientoResponse } from '../domain/refinanciamiento.types'

export class RefinanciamientoRequestError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.name = 'RefinanciamientoRequestError'; this.status = status }
}

function rethrow(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const data: unknown = error.response?.data
    const raw = data && typeof data === 'object' && 'message' in data ? (data as { message?: unknown }).message : undefined
    const message = Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string').join(' ') : typeof raw === 'string' ? raw : 'No se pudo completar la solicitud.'
    throw new RefinanciamientoRequestError(error.response?.status ?? 0, message)
  }
  throw error
}

export class AxiosRefinanciamientoRepository implements RefinanciamientoRepository {
  async list(filters: RefinanciamientoListFilters): Promise<RefinanciamientoPage> {
    try { return (await apiClient.get<RefinanciamientoPage>('/refinanciamientos', { params: filters })).data } catch (error) { return rethrow(error) }
  }
  async preview(prestamoId: number): Promise<RefinanciamientoPreview> {
    try { return (await apiClient.get<RefinanciamientoPreview>(`/refinanciamientos/prestamo/${prestamoId}/preview`)).data } catch (error) { return rethrow(error) }
  }
  async create(input: CrearRefinanciamientoInput): Promise<RefinanciamientoResponse> {
    try { return (await apiClient.post<RefinanciamientoResponse>('/refinanciamientos', input)).data } catch (error) { return rethrow(error) }
  }
}
