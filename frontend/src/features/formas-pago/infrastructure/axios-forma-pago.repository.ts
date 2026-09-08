import axios from 'axios'
import { apiClient } from '@/core/api/client'
import { FormaPagoError } from '../domain/forma-pago.error'
import type { FormaPago, FormaPagoInput, FormaPagoRepository, FormasPagoPaginadas } from '../domain/forma-pago.types'

function rethrow(error: unknown): never {
  if (axios.isAxiosError(error)) throw new FormaPagoError(error.response?.status ?? 0, 'formas de pago request failed')
  throw error
}

export class AxiosFormaPagoRepository implements FormaPagoRepository {
  async list(): Promise<FormaPago[]> {
    try { return (await apiClient.get<FormaPago[]>('/formas-pago')).data } catch (error) { return rethrow(error) }
  }

  async listAdministration(pagina: number, limite: number): Promise<FormasPagoPaginadas> {
    try { return (await apiClient.get<FormasPagoPaginadas>('/formas-pago/administracion', { params: { pagina, limite } })).data } catch (error) { return rethrow(error) }
  }

  async getById(id: number): Promise<FormaPago> {
    try { return (await apiClient.get<FormaPago>(`/formas-pago/${id}`)).data } catch (error) { return rethrow(error) }
  }

  async create(input: FormaPagoInput): Promise<FormaPago> {
    try { return (await apiClient.post<FormaPago>('/formas-pago', input)).data } catch (error) { return rethrow(error) }
  }

  async update(id: number, input: FormaPagoInput): Promise<FormaPago> {
    try { return (await apiClient.put<FormaPago>(`/formas-pago/${id}`, input)).data } catch (error) { return rethrow(error) }
  }

  async changeStatus(id: number, activo: boolean): Promise<FormaPago> {
    try { return (await apiClient.patch<FormaPago>(`/formas-pago/${id}/estado`, { activo })).data } catch (error) { return rethrow(error) }
  }
}
