import axios from 'axios'
import { apiClient } from '@/core/api/client'
import { PrestamoError } from '../domain/prestamo.error'
import type { AnularPagoInput, Pago, PagoRegistrado, PagoResumen, RegistrarPagoInput } from '../domain/pago.types'
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

  async getSummaryByPrestamo(prestamoId: number): Promise<PagoResumen> {
    try { return (await apiClient.get<PagoResumen>(`/pagos/prestamo/${prestamoId}/resumen`)).data } catch (error) { return rethrow(error) }
  }
  async cancel(id: number, input: AnularPagoInput): Promise<void> {
    try { await apiClient.post(`/pagos/${id}/anular`, input) } catch (error) { return rethrow(error) }
  }
}
