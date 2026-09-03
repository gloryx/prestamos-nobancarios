import type { LoginCredentials, LoginResult, User } from './auth.types'

export interface AuthRepository {
  login(credentials: LoginCredentials): Promise<LoginResult>
  getCurrentUser(): Promise<User>
}
