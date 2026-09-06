import axios from 'axios'
import { apiClient } from '@/core/api/client'
import { PrestamoError } from '../domain/prestamo.error'
import type { PlanPago, Prestamo, PrestamoFilters, PrestamoInput, PrestamoPage } from '../domain/prestamo.types'
import type { PrestamoRepository } from '../domain/prestamo.repository'

function rethrow(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const responseData: unknown = error.response?.data
    const rawMessage = responseData && typeof responseData === 'object' && 'message' in responseData
      ? (responseData as { message?: unknown }).message
      : undefined
    const message = Array.isArray(rawMessage)
      ? rawMessage.filter((item): item is string => typeof item === 'string').join(' ')
      : typeof rawMessage === 'string' ? rawMessage : undefined
    throw new PrestamoError(error.response?.status ?? 0, message)
  }
  throw error
}

export class AxiosPrestamoRepository implements PrestamoRepository {
  async list(filters: PrestamoFilters): Promise<PrestamoPage> {
    try {
      return (await apiClient.get<PrestamoPage>('/prestamos', { params: filters })).data
    } catch (error) {
      return rethrow(error)
    }
  }

  async getById(id: number): Promise<Prestamo> {
    try {
      return (await apiClient.get<Prestamo>(`/prestamos/${id}`)).data
    } catch (error) {
      return rethrow(error)
    }
  }

  async create(input: PrestamoInput): Promise<Prestamo> {
    try {
      return (await apiClient.post<Prestamo>('/prestamos', input)).data
    } catch (error) {
      return rethrow(error)
    }
  }

  async getPaymentPlanPdf(id: number): Promise<Blob> {
    try {
      const response = await apiClient.get<Blob>(`/prestamos/${id}/plan-pago/pdf`, { responseType: 'blob' })
      return response.data
    } catch (error) {
      return rethrow(error)
    }
  }
  async getPaymentPlan(id: number): Promise<PlanPago[]> {
    try { return (await apiClient.get<PlanPago[]>(`/planes-pago/prestamo/${id}`)).data } catch (error) { return rethrow(error) }
  }
  async getAccountStatementPdf(id: number): Promise<Blob> {
    try { return (await apiClient.get<Blob>(`/prestamos/${id}/estado-cuenta/pdf`, { responseType: 'blob' })).data } catch (error) { return rethrow(error) }
  }
}
