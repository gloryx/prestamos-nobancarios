import { AxiosFlujoPrestamosRepository } from '@/features/reportes/infrastructure/axios-flujo-prestamos.repository'
import { apiClient } from '@/core/api/client'
import { obtenerDashboard } from '../application/dashboard.use-case'
import type { DashboardRepository } from '../domain/dashboard.types'

export class AxiosDashboardRepository implements DashboardRepository {
  private readonly flujo = new AxiosFlujoPrestamosRepository()

  get(periodo: string) {
    return obtenerDashboard(periodo, this.flujo, () => this.getActivePortfolio())
  }

  async getActivePortfolio() {
    return (await apiClient.get<{ capitalPendiente: number }>('/prestamos/resumen-cartera-activa')).data
  }
}
