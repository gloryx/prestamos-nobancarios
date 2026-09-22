import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/app/providers/auth-context'
import type { Role } from '../domain/auth.types'

export function LoadingShell() { return <main className="loading-shell" aria-live="polite" aria-busy="true"><p>Verificando sesión...</p></main> }
export function ProtectedRoute({ role, children }: { role?: Role | Role[]; children?: ReactNode } = {}) { const { isLoading, isAuthenticated, user } = useAuth(); const location = useLocation(); if (isLoading) return <LoadingShell />; if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />; const allowed = role ? (Array.isArray(role) ? role : [role]) : undefined; if (allowed && (!user || !allowed.includes(user.rol))) return <ForbiddenShell />; return children ?? <Outlet /> }
function ForbiddenShell() { return <main className="loading-shell"><section><h1>Acceso denegado</h1><p>No tenés permisos para acceder a este módulo.</p><a href="/">Volver al inicio</a></section></main> }
