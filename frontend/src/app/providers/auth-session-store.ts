import { getToken, removeToken, saveToken } from '@/core/storage/token-storage'
import { GetCurrentUserUseCase } from '@/features/auth/application/get-current-user.use-case'
import { LoginUseCase } from '@/features/auth/application/login.use-case'
import { AuthError } from '@/features/auth/domain/auth.error'
import type { LoginCredentials, User } from '@/features/auth/domain/auth.types'
import { AxiosAuthRepository } from '@/features/auth/infrastructure/axios-auth.repository'

export interface AuthSessionState {
  user: User | null
  isLoading: boolean
  error: string | null
}

const repository = new AxiosAuthRepository()
const loginUseCase = new LoginUseCase(repository)
const currentUserUseCase = new GetCurrentUserUseCase(repository)
const listeners = new Set<() => void>()

let snapshot: AuthSessionState = {
  user: null,
  isLoading: Boolean(getToken()),
  error: null,
}
let restoration: Promise<void> | null = null

function errorMessage(error: unknown) {
  if (error instanceof AuthError) return { 'invalid-credentials': 'Identificación o contraseña incorrecta.', inactive: 'El usuario está inactivo.', unavailable: 'No fue posible conectar con el servidor.', unexpected: 'Ocurrió un error inesperado. Intentá nuevamente.' }[error.kind]
  return 'Ocurrió un error inesperado. Intentá nuevamente.'
}

function update(next: AuthSessionState) {
  snapshot = next
  listeners.forEach((listener) => listener())
}

export const authSessionStore = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  getSnapshot() {
    return snapshot
  },

  async restore() {
    if (restoration) return restoration

    restoration = (async () => {
      if (!getToken()) {
        update({ ...snapshot, isLoading: false })
        return
      }

      try {
        update({ ...snapshot, user: await currentUserUseCase.execute() })
      } catch (cause) {
        removeToken()
        update({ ...snapshot, user: null, error: cause instanceof AuthError && cause.kind === 'unavailable' ? errorMessage(cause) : snapshot.error })
      } finally {
        update({ ...snapshot, isLoading: false })
      }
    })()

    try {
      await restoration
    } finally {
      restoration = null
    }
  },

  async login(credentials: LoginCredentials) {
    update({ ...snapshot, error: null })
    try {
      const result = await loginUseCase.execute(credentials)
      saveToken(result.accessToken)
      update({ ...snapshot, user: await currentUserUseCase.execute() })
      return true
    } catch (cause) {
      removeToken()
      update({ ...snapshot, user: null, error: errorMessage(cause) })
      return false
    }
  },

  logout() {
    removeToken()
    update({ ...snapshot, user: null })
  },

  expire() {
    removeToken()
    update({ ...snapshot, user: null, error: 'Tu sesión expiró. Iniciá sesión nuevamente.' })
  },
}
