import { useCallback, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from './auth-context'
import { authSessionStore } from './auth-session-store'

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { user, isLoading, error } = useSyncExternalStore(authSessionStore.subscribe, authSessionStore.getSnapshot, authSessionStore.getSnapshot)
  useEffect(() => { void authSessionStore.restore(); const onExpired = () => authSessionStore.expire(); window.addEventListener('auth-session-expired', onExpired); return () => window.removeEventListener('auth-session-expired', onExpired) }, [])
  const login = useCallback((credentials: Parameters<typeof authSessionStore.login>[0]) => authSessionStore.login(credentials), [])
  const logout = useCallback(() => { authSessionStore.logout(); navigate('/login') }, [navigate])
  const value = useMemo(() => ({ user, isAuthenticated: Boolean(user), isLoading, error, login, logout }), [user, isLoading, error, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
