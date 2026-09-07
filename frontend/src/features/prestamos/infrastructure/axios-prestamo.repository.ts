import axios from 'axios'
import { apiClient } from '@/core/api/client'
import { PrestamoError } from '../domain/prestamo.error'
import type { PlanPago, Prestamo, PrestamoExportFilters, PrestamoFilters, PrestamoInput, PrestamoPage, PrestamosResumen } from '../domain/prestamo.types'
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
      const params = { ...filters, estados: filters.estados?.join(',') }
      return (await apiClient.get<PrestamoPage>('/prestamos', { params })).data
    } catch (error) {
      return rethrow(error)
    }
  }

  async summary(filters: PrestamoFilters): Promise<PrestamosResumen> {
    try {
      const params = { ...filters, estados: filters.estados?.join(',') }
      return (await apiClient.get<PrestamosResumen>('/prestamos/resumen', { params })).data
    } catch (error) {
      return rethrow(error)
    }
  }

  async exportarExcel(filters: PrestamoExportFilters): Promise<{ blob: Blob; filename?: string }> {
    try {
      const params = { buscar: filters.buscar, direccion: filters.direccion, estados: filters.estados?.join(','), fechaInicio: filters.fechaInicio, fechaFin: filters.fechaFin }
      const response = await apiClient.get<Blob>('/prestamos/export/excel', { params, responseType: 'blob' })
      const disposition = response.headers['content-disposition'] as string | undefined
      const match = disposition?.match(/filename\*?=(?:UTF-8'')?['"]?([^;"']+)/i)
      return { blob: response.data, filename: match?.[1] ? decodeURIComponent(match[1]) : undefined }
    } catch (error) { return rethrow(error) }
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
  async adjustPaymentPlanAmount(id: number, montoProgramado: number): Promise<{ actualizada: PlanPago; siguiente: PlanPago }> {
    try { return (await apiClient.patch<{ actualizada: PlanPago; siguiente: PlanPago }>(`/planes-pago/${id}/monto`, { montoProgramado })).data } catch (error) { return rethrow(error) }
  }
  async getAccountStatementPdf(id: number): Promise<Blob> {
    try { return (await apiClient.get<Blob>(`/prestamos/${id}/estado-cuenta/pdf`, { responseType: 'blob' })).data } catch (error) { return rethrow(error) }
  }
}
