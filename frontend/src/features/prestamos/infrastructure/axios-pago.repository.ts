import axios from 'axios'
import { apiClient } from '@/core/api/client'
import { PrestamoError } from '../domain/prestamo.error'
import type { AnularPagoInput, Pago, PagoRegistrado, PagoResumen, PagosHistoryFilters, PagosPage, RegistrarPagoInput } from '../domain/pago.types'
import type { PagoRepository } from '../domain/pago.repository'

function rethrow(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const data: unknown = error.response?.data
    const rawMessage = data && typeof data === 'object' && 'message' in data ? (data as { message?: unknown }).message : undefined
    const message = Array.isArray(rawMessage) ? rawMessage.filter((item): item is string => typeof item === 'string').join(' ') : typeof rawMessage === 'string' ? rawMessage : undefined
    throw new PrestamoError(error.response?.status ?? 0, message)
  }
  throw error
}

export class AxiosPagoRepository implements PagoRepository {
  async create(input: RegistrarPagoInput): Promise<PagoRegistrado> {
    try { return (await apiClient.post<PagoRegistrado>('/pagos', input)).data } catch (error) { return rethrow(error) }
  }
  async listByPrestamo(prestamoId: number): Promise<Pago[]> {
    try { return (await apiClient.get<Pago[]>(`/pagos/prestamo/${prestamoId}`)).data } catch (error) { return rethrow(error) }
  }
  async listPage(filters: PagosHistoryFilters): Promise<PagosPage> {
    try { return (await apiClient.get<PagosPage>('/pagos', { params: Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== '')) })).data } catch (error) { return rethrow(error) }
  }
  async exportPdf(filters: PagosHistoryFilters): Promise<{ blob: Blob; filename: string }> {
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([key, value]) => !['pagina', 'limite'].includes(key) && value !== undefined && value !== ''))
      const response = await apiClient.get<Blob>('/pagos/exportar/pdf', { params, responseType: 'blob', timeout: 120000 })
      const disposition = response.headers['content-disposition'] as string | undefined
      const match = disposition?.match(/filename="?([^";]+)"?/i)
      return { blob: response.data, filename: match?.[1] || `historial-pagos-${filters.fechaDesde || 'inicio'}-${filters.fechaHasta || 'fin'}.pdf` }
    } catch (error) { return rethrow(error) }
  }

  async getSummaryByPrestamo(prestamoId: number): Promise<PagoResumen> {
    try { return (await apiClient.get<PagoResumen>(`/pagos/prestamo/${prestamoId}/resumen`)).data } catch (error) { return rethrow(error) }
  }
  async cancel(id: number, input: AnularPagoInput): Promise<void> {
    try { await apiClient.post(`/pagos/${id}/anular`, input) } catch (error) { return rethrow(error) }
  }
}
