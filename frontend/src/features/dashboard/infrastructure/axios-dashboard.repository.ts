import { AxiosFlujoPrestamosRepository } from '@/features/reportes/infrastructure/axios-flujo-prestamos.repository'
import { AxiosPrestamoRepository } from '@/features/prestamos/infrastructure/axios-prestamo.repository'
import { obtenerDashboard } from '../application/dashboard.use-case'
import type { DashboardRepository } from '../domain/dashboard.types'

export class AxiosDashboardRepository implements DashboardRepository {
  private readonly flujo = new AxiosFlujoPrestamosRepository()
  private readonly prestamos = new AxiosPrestamoRepository()

  get(periodo: string) {
    return obtenerDashboard(periodo, this.flujo, this.prestamos)
  }
}
