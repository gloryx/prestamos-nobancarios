import axios from 'axios'
import { apiClient } from '@/core/api/client'
import { PrestamoError } from '../domain/prestamo.error'
import type { AnulacionesPage, AnularPrestamoInput, CambiarEstadoPrestamoInput, IncobrablesFilters, IncobrablesPage, PersonalizarPlanPagoInput, PersonalizarPlanPagoResponse, PlanPago, Prestamo, PrestamoExportFilters, PrestamoFilters, PrestamoInput, PrestamoPage, PrestamosResumen, PrestamoUpdateInput } from '../domain/prestamo.types'
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

  async update(id: number, input: PrestamoUpdateInput): Promise<Prestamo> {
    try {
      return (await apiClient.put<Prestamo>(`/prestamos/${id}`, input)).data
    } catch (error) {
      return rethrow(error)
    }
  }

  async cancel(id: number, input: AnularPrestamoInput): Promise<Prestamo> {
    try {
      return (await apiClient.post<Prestamo>(`/prestamos/${id}/anular`, input)).data
    } catch (error) {
      return rethrow(error)
    }
  }

  async changeStatus(id: number, input: CambiarEstadoPrestamoInput): Promise<Prestamo> {
    try {
      return (await apiClient.patch<Prestamo>(`/prestamos/${id}/estado`, input)).data
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
  async adjustPaymentPlanAmount(id: number, montoProgramado?: number, fechaVencimiento?: string): Promise<{ actualizada: PlanPago; siguiente: PlanPago }> {
    try { return (await apiClient.patch<{ actualizada: PlanPago; siguiente: PlanPago }>(`/planes-pago/${id}/monto`, { ...(montoProgramado === undefined ? {} : { montoProgramado }), ...(fechaVencimiento === undefined ? {} : { fechaVencimiento }) })).data } catch (error) { return rethrow(error) }
  }
  async personalizePaymentPlan(id: number, input: PersonalizarPlanPagoInput): Promise<PersonalizarPlanPagoResponse> {
    try { return (await apiClient.put<PersonalizarPlanPagoResponse>(`/planes-pago/prestamo/${id}/personalizar`, input)).data } catch (error) { return rethrow(error) }
  }
  async getAccountStatementPdf(id: number): Promise<Blob> {
    try { return (await apiClient.get<Blob>(`/prestamos/${id}/estado-cuenta/pdf`, { responseType: 'blob' })).data } catch (error) { return rethrow(error) }
  }
  async listIncobrableCandidates(filters: IncobrablesFilters): Promise<IncobrablesPage> { try { return (await apiClient.get<IncobrablesPage>('/prestamos/candidatos-incobrables', { params: filters })).data } catch (error) { return rethrow(error) } }
  async listIncobrables(filters: IncobrablesFilters): Promise<IncobrablesPage> { try { return (await apiClient.get<IncobrablesPage>('/prestamos/incobrables', { params: filters })).data } catch (error) { return rethrow(error) } }
  async listCancellationCandidates(filters: PrestamoFilters): Promise<PrestamoPage> { try { return (await apiClient.get<PrestamoPage>('/prestamos/candidatos-anulacion', { params: { ...filters, estados: undefined } })).data } catch (error) { return rethrow(error) } }
  async listCancelled(filters: PrestamoFilters): Promise<AnulacionesPage> { try { return (await apiClient.get<AnulacionesPage>('/prestamos/anulados', { params: filters })).data } catch (error) { return rethrow(error) } }
}
