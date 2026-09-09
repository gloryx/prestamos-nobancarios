import axios from 'axios'
import { apiClient } from '@/core/api/client'
import type { CadenasClienteResponse, CadenasRepository } from '../domain/cadenas.types'

export class CadenasRequestError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.name = 'CadenasRequestError'; this.status = status }
}

function rethrow(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const data: unknown = error.response?.data
    const raw = data && typeof data === 'object' && 'message' in data ? (data as { message?: unknown }).message : undefined
    const message = Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string').join(' ') : typeof raw === 'string' ? raw : 'No se pudieron cargar las cadenas de refinanciamiento.'
    throw new CadenasRequestError(error.response?.status ?? 0, message)
  }
  throw error
}

export class AxiosCadenasRepository implements CadenasRepository {
  async listByClient(clientId: number): Promise<CadenasClienteResponse> {
    try { return (await apiClient.get<CadenasClienteResponse>(`/refinanciamientos/cliente/${clientId}/cadenas`)).data } catch (error) { return rethrow(error) }
  }
}
