import axios from 'axios'
import { apiClient } from '@/core/api/client'
import { UsuarioError } from '../domain/usuario.error'
import type { ActualizarUsuarioInput, CrearUsuarioInput, Usuario, UsuarioFilters, UsuarioPage, UsuarioRepository } from '../domain/usuario.types'

function rethrow(error: unknown): never {
  if (axios.isAxiosError(error)) throw new UsuarioError(error.response?.status ?? 0, 'usuarios request failed')
  throw error
}

export class AxiosUsuarioRepository implements UsuarioRepository {
  async list(filters: UsuarioFilters): Promise<UsuarioPage> {
    try { return (await apiClient.get<UsuarioPage>('/usuarios', { params: filters })).data } catch (error) { return rethrow(error) }
  }
  async create(input: CrearUsuarioInput): Promise<Usuario> {
    try { return (await apiClient.post<Usuario>('/usuarios', input)).data } catch (error) { return rethrow(error) }
  }
  async update(id: number, input: ActualizarUsuarioInput): Promise<Usuario> {
    try { return (await apiClient.put<Usuario>(`/usuarios/${id}`, input)).data } catch (error) { return rethrow(error) }
  }
  async changeStatus(id: number, activo: boolean): Promise<Usuario> {
    try { return (await apiClient.patch<Usuario>(`/usuarios/${id}/estado`, { activo })).data } catch (error) { return rethrow(error) }
  }
}
