import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/app/providers/auth-context'

export function LoadingShell() { return <main className="loading-shell" aria-live="polite" aria-busy="true"><p>Verificando sesión...</p></main> }
export function ProtectedRoute({ role }: { role?: 'ADMINISTRADOR' | 'VENDEDOR' } = {}) { const { isLoading, isAuthenticated, user } = useAuth(); const location = useLocation(); if (isLoading) return <LoadingShell />; if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />; return role && user?.rol !== role ? <ForbiddenShell /> : <Outlet /> }
function ForbiddenShell() { return <main className="loading-shell"><section><h1>Acceso denegado</h1><p>No tenés permisos para acceder a este módulo.</p><a href="/">Volver al inicio</a></section></main> }
