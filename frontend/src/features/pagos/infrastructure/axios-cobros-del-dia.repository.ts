import axios from 'axios'
import { apiClient } from '@/core/api/client'
import { PrestamoError } from '@/features/prestamos/domain/prestamo.error'
import type { CobrosDelDiaRepository } from '../domain/cobros-del-dia.repository'
import type { CobrosDelDiaResponse } from '../domain/cobros-del-dia.types'

export class AxiosCobrosDelDiaRepository implements CobrosDelDiaRepository {
  async consultar(fecha: string): Promise<CobrosDelDiaResponse> {
    try {
      return (await apiClient.get<CobrosDelDiaResponse>('/pagos/cobros-del-dia', { params: { fecha } })).data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const data: unknown = error.response?.data
        const raw = data && typeof data === 'object' && 'message' in data ? (data as { message?: unknown }).message : undefined
        const message = Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string').join(' ') : typeof raw === 'string' ? raw : undefined
        throw new PrestamoError(error.response?.status ?? 0, message)
      }
      throw error
    }
  }
}
