import type { LucideIcon } from 'lucide-react'
import { BarChart3, Banknote, BriefcaseBusiness, CalendarDays, ChartNoAxesCombined, CircleDollarSign, ClipboardList, CreditCard, FileBarChart, FileText, HandCoins, LayoutDashboard, Landmark, ListChecks, Receipt, Settings, SlidersHorizontal, UserPlus, Users, WalletCards, WalletMinimal } from 'lucide-react'

export type NavItem = { label: string; path: string; icon?: LucideIcon; separatorBefore?: boolean }
export type NavGroup = { label: string; icon: LucideIcon; items: Array<NavItem | NavGroup>; separatorBefore?: boolean }

export const navigation: Array<NavItem | NavGroup> = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Clientes', icon: Users, items: [
    { label: 'Clientes', path: '/clientes', icon: Users }, { label: 'Nuevo cliente', path: '/clientes/nuevo', icon: UserPlus }, { label: 'Análisis', path: '/clientes/analisis', icon: ChartNoAxesCombined }, { label: 'Reporte', path: '/clientes/reporte', icon: FileBarChart, separatorBefore: true },
  ] },
  { label: 'Préstamos', icon: BriefcaseBusiness, items: [
    { label: 'Préstamos', path: '/prestamos', icon: BriefcaseBusiness }, { label: 'Nuevo préstamo', path: '/prestamos/nuevo', icon: CreditCard }, { label: 'Activos', path: '/prestamos/activos', icon: ListChecks }, { label: 'Todos', path: '/prestamos/todos', icon: ClipboardList }, { label: 'Incobrables', path: '/prestamos/incobrables', icon: FileText }, { label: 'Reporte de cartera', path: '/prestamos/reporte', icon: FileBarChart, separatorBefore: true }, { label: 'Proyección', path: '/prestamos/proyeccion', icon: BarChart3 },
  ] },
  { label: 'Pagos', icon: HandCoins, items: [
    { label: 'Cobros del día', path: '/pagos', icon: HandCoins }, { label: 'Registrar pago', path: '/pagos/registrar', icon: CreditCard }, { label: 'Historial', path: '/pagos/historial', icon: ClipboardList }, { label: 'Reportes', path: '/pagos/reportes', icon: FileBarChart, separatorBefore: true },
  ] },
  { label: 'Refinanciamientos', icon: WalletCards, items: [
    { label: 'Refinanciamientos', path: '/refinanciamientos', icon: WalletCards }, { label: 'Nuevo refinanciamiento', path: '/refinanciamientos/nuevo', icon: CreditCard }, { label: 'Reporte', path: '/refinanciamientos/reporte', icon: FileBarChart, separatorBefore: true },
  ] },
  { label: 'FINANZAS', icon: Landmark, items: [
    { label: 'Caja', icon: WalletMinimal, items: [{ label: 'Movimientos', path: '/finanzas/caja/movimientos', icon: ListChecks }, { label: 'Aportes y retiros', path: '/finanzas/caja/aportes-retiros', icon: CircleDollarSign }, { label: 'Gastos', path: '/finanzas/caja/gastos', icon: Receipt }, { label: 'Cortes', path: '/finanzas/caja/cortes', icon: CalendarDays }, { label: 'Reportes', path: '/finanzas/caja/reportes', icon: FileBarChart, separatorBefore: true }] },
    { label: 'Ingresos', icon: Banknote, items: [{ label: 'Registrar ingreso', path: '/finanzas/ingresos/registrar', icon: CircleDollarSign }, { label: 'Historial', path: '/finanzas/ingresos/historial', icon: ClipboardList }, { label: 'Fuentes', path: '/finanzas/ingresos/fuentes', icon: SlidersHorizontal }, { label: 'Reportes', path: '/finanzas/ingresos/reportes', icon: FileBarChart, separatorBefore: true }] },
  ] },
  { label: 'Configuración', icon: Settings, items: [
    { label: 'Periodicidades', path: '/configuracion/periodicidades', icon: CalendarDays }, { label: 'Formas de pago', path: '/configuracion/formas-de-pago', icon: CreditCard }, { label: 'Usuarios', path: '/configuracion/usuarios', icon: Users }, { label: 'Configuración financiera', path: '/configuracion/financiera', icon: SlidersHorizontal },
  ] },
]

export function isGroup(item: NavItem | NavGroup): item is NavGroup { return 'items' in item }
