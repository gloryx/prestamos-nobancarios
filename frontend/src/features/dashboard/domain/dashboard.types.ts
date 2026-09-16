import type { FlujoMes } from '@/features/reportes/domain/flujo-prestamos.types'
import type { PrestamosResumen } from '@/features/prestamos/domain/prestamo.types'

export interface DashboardData {
  periodo: string
  flujo: FlujoMes | null
  cartera: PrestamosResumen | null
  errors: string[]
}

export interface DashboardRepository {
  get(periodo: string): Promise<DashboardData>
}
