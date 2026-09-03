import { createContext, useContext } from 'react'
import type { LoginCredentials, User } from '@/features/auth/domain/auth.types'

export interface AuthContextValue { user: User | null; isAuthenticated: boolean; isLoading: boolean; error: string | null; login: (credentials: LoginCredentials) => Promise<boolean>; logout: () => void }
export const AuthContext = createContext<AuthContextValue | null>(null)
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used inside AuthProvider'); return context }
