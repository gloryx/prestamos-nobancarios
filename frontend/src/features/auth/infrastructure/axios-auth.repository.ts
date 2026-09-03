import axios from 'axios'
import { apiClient } from '@/core/api/client'
import { AuthError } from '../domain/auth.error'
import type { AuthRepository } from '../domain/auth.repository'
import type { LoginCredentials, LoginResult, Role, User } from '../domain/auth.types'

interface LoginDto { accessToken: string }
interface CurrentUserDto { id: number | string; identificacion: string; nombreCompleto: string; rol: Role; activo: boolean }

function mapError(error: unknown): AuthError {
  if (!axios.isAxiosError(error) || !error.response) return new AuthError('unavailable')
  if (error.response.status === 401) return new AuthError('invalid-credentials')
  if (error.response.status === 403) return new AuthError('inactive')
  return new AuthError('unexpected')
}

export class AxiosAuthRepository implements AuthRepository {
  async login(credentials: LoginCredentials): Promise<LoginResult> {
    try {
      const { data } = await apiClient.post<LoginDto>('/auth/login', credentials, { skipAuthSessionHandling: true })
      return { accessToken: data.accessToken }
    } catch (error) { throw mapError(error) }
  }

  async getCurrentUser(): Promise<User> {
    try {
      const { data } = await apiClient.get<CurrentUserDto>('/auth/me')
      return { id: data.id, identificacion: data.identificacion, nombreCompleto: data.nombreCompleto, rol: data.rol, activo: data.activo }
    } catch (error) { throw mapError(error) }
  }
}
