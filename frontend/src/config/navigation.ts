import type { LucideIcon } from 'lucide-react'
import { BarChart3, BriefcaseBusiness, CalendarDays, ChartNoAxesCombined, CircleAlert, CircleDollarSign, ClipboardList, CreditCard, FileBarChart, HandCoins, LayoutDashboard, Landmark, ListChecks, RefreshCw, Settings, SlidersHorizontal, UserPlus, Users, WalletCards, WalletMinimal } from 'lucide-react'
import type { Role } from '@/features/auth/domain/auth.types'

export type NavItem = { label: string; path: string; icon?: LucideIcon; separatorBefore?: boolean; allowedRoles?: Role[] }
export type NavGroup = { label: string; icon: LucideIcon; items: Array<NavItem | NavGroup>; separatorBefore?: boolean }

export const navigation: Array<NavItem | NavGroup> = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Clientes', icon: Users, items: [
    { label: 'Clientes', path: '/clientes', icon: Users }, { label: 'Nuevo cliente', path: '/clientes/nuevo', icon: UserPlus, allowedRoles: ['ADMINISTRADOR', 'VENDEDOR'] }, { label: 'Análisis financiero', path: '/clientes/analisis-financiero', icon: ChartNoAxesCombined }, { label: 'Reporte', path: '/clientes/reporte', icon: FileBarChart, separatorBefore: true },
  ] },
    { label: 'Préstamos', icon: BriefcaseBusiness, items: [
    { label: 'Préstamos', path: '/prestamos', icon: BriefcaseBusiness }, { label: 'Nuevo préstamo', path: '/prestamos/nuevo', icon: CreditCard, allowedRoles: ['ADMINISTRADOR', 'VENDEDOR'] }, { label: 'Seguimiento de cartera', path: '/prestamos/seguimiento-cartera', icon: ListChecks }, { label: 'Préstamos saldados', path: '/prestamos/saldados', icon: ClipboardList }, { label: 'Gestión de incobrables', path: '/prestamos/gestion-incobrables', icon: CircleAlert }, { label: 'Gestión de anulaciones', path: '/prestamos/gestion-anulaciones', icon: CircleAlert }, { label: 'Reporte de Cartera', path: '/prestamos/reporte', icon: FileBarChart, separatorBefore: true }, { label: 'Proyección', path: '/prestamos/proyeccion', icon: BarChart3 },
  ] },
  { label: 'Pagos', icon: HandCoins, items: [
    { label: 'Cobros del día', path: '/pagos', icon: HandCoins }, { label: 'Registrar pago', path: '/pagos/registrar', icon: CreditCard }, { label: 'Historial', path: '/pagos/historial', icon: ClipboardList }, { label: 'Reportes', icon: FileBarChart, separatorBefore: true, items: [{ label: 'Desempeño de cobradores', path: '/reportes/pagos/desempeno-cobradores', icon: BarChart3 }] },
  ] },
  { label: 'Refinanciamientos', icon: RefreshCw, items: [
    { label: 'Refinanciamientos', path: '/refinanciamientos', icon: RefreshCw }, { label: 'Cadenas', path: '/refinanciamientos/cadenas', icon: WalletCards }, { label: 'Nuevo refinanciamiento', path: '/refinanciamientos/nuevo', icon: CreditCard }, { label: 'Reporte', path: '/refinanciamientos/reporte', icon: FileBarChart, separatorBefore: true },
  ] },
  { label: 'FINANZAS', icon: Landmark, items: [
    { label: 'Caja', icon: WalletMinimal, items: [{ label: 'Estado de Caja', path: '/finanzas/caja/estado', icon: WalletMinimal }, { label: 'Operaciones de Caja', path: '/finanzas/caja/operaciones', icon: CircleDollarSign }, { label: 'Movimientos', path: '/finanzas/caja/movimientos', icon: ListChecks }, { label: 'Cortes', icon: CalendarDays, items: [{ label: 'Reporte de rentabilidad', path: '/finanzas/caja/cortes/rentabilidad-cancelados', icon: FileBarChart }, { label: 'Cierres mensuales', path: '/finanzas/cierres', icon: CalendarDays }] }] },
      { label: 'Reportes', icon: FileBarChart, items: [{ label: 'Flujo histórico', path: '/finanzas/reportes/flujo-prestamos', icon: BarChart3, separatorBefore: true }, { label: 'Reporte por forma de pago', path: '/finanzas/reportes/forma-pago', icon: BarChart3 }, { label: 'Análisis financiero', path: '/finanzas/reportes/analisis-financiero', icon: ChartNoAxesCombined }] },
  ] },
  { label: 'Configuración', icon: Settings, items: [
    { label: 'Periodicidades', path: '/configuracion/periodicidades', icon: CalendarDays, allowedRoles: ['ADMINISTRADOR', 'VENDEDOR'] }, { label: 'Formas de pago', path: '/configuracion/formas-de-pago', icon: CreditCard, allowedRoles: ['ADMINISTRADOR', 'VENDEDOR'] }, { label: 'Usuarios', path: '/configuracion/usuarios', icon: Users }, { label: 'Configuración financiera', path: '/configuracion/financiera', icon: SlidersHorizontal },
  ] },
]

export function isGroup(item: NavItem | NavGroup): item is NavGroup { return 'items' in item }

const adminOnlyPaths = new Set([
  '/', '/clientes/analisis-financiero', '/clientes/reporte', '/prestamos/resumen', '/prestamos/reporte', '/prestamos/proyeccion',
  '/reportes/pagos/desempeno-cobradores', '/pagos/historial', '/refinanciamientos/reporte', '/finanzas/caja/estado', '/finanzas/caja/operaciones',
  '/finanzas/caja/movimientos', '/finanzas/caja/cortes/rentabilidad-cancelados', '/finanzas/cierres', '/finanzas/reportes/flujo-prestamos',
  '/finanzas/reportes/forma-pago', '/finanzas/reportes/analisis-financiero', '/configuracion/usuarios', '/configuracion/financiera',
])

export function navigationForRole(role: Role): Array<NavItem | NavGroup> {
  const filter = (items: Array<NavItem | NavGroup>): Array<NavItem | NavGroup> => items.flatMap<NavItem | NavGroup>((item) => {
    if (isGroup(item)) {
      const children = filter(item.items)
      return children.length ? [{ ...item, items: children }] : []
    }
    if (item.allowedRoles && !item.allowedRoles.includes(role)) return []
    return adminOnlyPaths.has(item.path) && role !== 'ADMINISTRADOR' ? [] : [item]
  })
  return filter(navigation)
}
