import { apiClient } from '@/core/api/client'
import type { AnalisisFinancieroRepository, ComparativoAnualAnalisisFinanciero, ResumenMensualAnalisisFinanciero } from '../domain/analisis-financiero.types'

export class AxiosAnalisisFinancieroRepository implements AnalisisFinancieroRepository {
  async obtenerResumenMensual(anio: number): Promise<ResumenMensualAnalisisFinanciero> {
    return (await apiClient.get<ResumenMensualAnalisisFinanciero>('/analisis-financiero/resumen-mensual', { params: { anio } })).data
  }

  async obtenerComparativoAnual(desde: number, hasta: number): Promise<ComparativoAnualAnalisisFinanciero> {
    return (await apiClient.get<ComparativoAnualAnalisisFinanciero>('/analisis-financiero/comparativo-anual', { params: { desde, hasta } })).data
  }
}
