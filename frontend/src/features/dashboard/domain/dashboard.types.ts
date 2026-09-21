import type { FlujoMes } from '@/features/reportes/domain/flujo-prestamos.types'

export interface DashboardPortfolio { capitalPendiente: number }

export interface DashboardData {
  periodo: string
  flujo: FlujoMes | null
  cartera: DashboardPortfolio | null
  errors: string[]
}

export interface DashboardRepository {
  get(periodo: string): Promise<DashboardData>
  getActivePortfolio(): Promise<DashboardPortfolio>
}
