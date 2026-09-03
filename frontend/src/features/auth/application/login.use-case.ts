import type { AuthRepository } from '../domain/auth.repository'
import type { LoginCredentials, LoginResult } from '../domain/auth.types'

export class LoginUseCase {
  private readonly repository: AuthRepository
  constructor(repository: AuthRepository) { this.repository = repository }
  execute(credentials: LoginCredentials): Promise<LoginResult> { return this.repository.login(credentials) }
}
