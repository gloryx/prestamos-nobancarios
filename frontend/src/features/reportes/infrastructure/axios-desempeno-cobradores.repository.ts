import { apiClient } from '@/core/api/client'
import type { DesempenoCobradoresFilters, DesempenoCobradoresReport, DesempenoCobradoresRepository } from '../domain/desempeno-cobradores.types'
export class AxiosDesempenoCobradoresRepository implements DesempenoCobradoresRepository {
  async get(filters: DesempenoCobradoresFilters): Promise<DesempenoCobradoresReport> { return (await apiClient.get<DesempenoCobradoresReport>('/reportes/desempeno-cobradores', { params: filters })).data }
  async exportPdf(filters: DesempenoCobradoresFilters): Promise<{ blob: Blob; filename: string }> {
    const response = await apiClient.get<Blob>('/reportes/desempeno-cobradores/exportar/pdf', { params: filters, responseType: 'blob', timeout: 120000 })
    const disposition = response.headers['content-disposition'] as string | undefined
    const match = disposition?.match(/filename="?([^";]+)"?/i)
    return { blob: response.data, filename: match?.[1] || `desempeno-cobradores-${filters.fechaDesde}-${filters.fechaHasta}.pdf` }
  }
}
