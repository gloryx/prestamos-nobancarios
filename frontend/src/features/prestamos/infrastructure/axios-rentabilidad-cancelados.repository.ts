import axios from 'axios'
import { apiClient } from '@/core/api/client'
import type { RentabilidadCanceladosReport, RentabilidadCanceladosRepository } from '../domain/rentabilidad-cancelados.types'

export class RentabilidadCanceladosRequestError extends Error {
  readonly status: number
  constructor(status: number, message: string) { super(message); this.name = 'RentabilidadCanceladosRequestError'; this.status = status }
}

export class AxiosRentabilidadCanceladosRepository implements RentabilidadCanceladosRepository {
  async report(anio: number, mes: number): Promise<RentabilidadCanceladosReport> {
    try {
      return (await apiClient.get<RentabilidadCanceladosReport>('/prestamos/reporte/rentabilidad-cancelados', { params: { anio, mes } })).data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const raw = error.response?.data && typeof error.response.data === 'object' && 'message' in error.response.data ? (error.response.data as { message?: unknown }).message : undefined
        const message = Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string').join(' ') : typeof raw === 'string' ? raw : 'No se pudo cargar el reporte de rentabilidad.'
        throw new RentabilidadCanceladosRequestError(error.response?.status ?? 0, message)
      }
      throw error
    }
  }
}
