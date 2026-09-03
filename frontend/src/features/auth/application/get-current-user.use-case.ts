import type { AuthRepository } from '../domain/auth.repository'
import type { User } from '../domain/auth.types'

export class GetCurrentUserUseCase {
  private readonly repository: AuthRepository
  constructor(repository: AuthRepository) { this.repository = repository }
  execute(): Promise<User> { return this.repository.getCurrentUser() }
}
