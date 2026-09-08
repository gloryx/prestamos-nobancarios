import axios from 'axios'
import { apiClient } from '@/core/api/client'
import { ClienteError } from '../domain/cliente.error'
import type { ActualizarClienteInput, AnalisisFinancieroResponse, Cliente, ClienteFilters, ClientePage, ClienteRepository, ClientesResumen, CrearClienteInput } from '../domain/cliente.types'

function rethrow(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data && typeof error.response.data === 'object' && 'message' in error.response.data
      ? error.response.data.message
      : undefined
    throw new ClienteError(error.response?.status ?? 0, typeof message === 'string' ? message : undefined)
  }
  throw error
}

export class AxiosClienteRepository implements ClienteRepository {
  async list(filters: ClienteFilters): Promise<ClientePage> { try { return (await apiClient.get<ClientePage>('/clientes', { params: filters })).data } catch (error) { return rethrow(error) } }
  async summary(): Promise<ClientesResumen> { try { return (await apiClient.get<ClientesResumen>('/clientes/resumen')).data } catch (error) { return rethrow(error) } }
  async getById(id: number): Promise<Cliente> { try { return (await apiClient.get<Cliente>(`/clientes/${id}`)).data } catch (error) { return rethrow(error) } }
  async getIdentificationImage(id: number): Promise<Blob> { try { return (await apiClient.get<Blob>(`/clientes/${id}/identificacion-imagen`, { responseType: 'blob' })).data } catch (error) { return rethrow(error) } }
  async downloadClientSheet(id: number): Promise<Blob> { try { return (await apiClient.get<Blob>(`/clientes/${id}/ficha-pdf`, { responseType: 'blob' })).data } catch (error) { return rethrow(error) } }
  async getFinancialAnalysis(id: number): Promise<AnalisisFinancieroResponse> { try { return (await apiClient.get<AnalisisFinancieroResponse>(`/clientes/${id}/analisis-financiero`)).data } catch (error) { return rethrow(error) } }
  private multipart(input: CrearClienteInput | ActualizarClienteInput): FormData { const form = new FormData(); Object.entries(input).forEach(([key, value]) => { if (key === 'identificacionFile') { if (value instanceof File) form.append('identificacionFile', value); return } if (key === 'correo' && (value === null || value === undefined || String(value).trim() === '')) return; if (value !== null && value !== undefined) form.append(key, String(value)); else form.append(key, '') }); return form }
  async create(input: CrearClienteInput): Promise<Cliente> { try { return (await apiClient.post<Cliente>('/clientes', this.multipart(input))).data } catch (error) { return rethrow(error) } }
  async update(id: number, input: ActualizarClienteInput): Promise<Cliente> { try { return (await apiClient.put<Cliente>(`/clientes/${id}`, this.multipart(input))).data } catch (error) { return rethrow(error) } }
  async changeStatus(id: number, activo: boolean): Promise<Cliente> { try { return (await apiClient.patch<Cliente>(`/clientes/${id}/estado`, { activo })).data } catch (error) { return rethrow(error) } }
}
