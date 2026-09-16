import type { FlujoPrestamosRepository } from '@/features/reportes/domain/flujo-prestamos.types'
import type { PrestamoRepository } from '@/features/prestamos/domain/prestamo.repository'
import type { DashboardData } from '../domain/dashboard.types'

export function obtenerDashboard(
  periodo: string,
  flujoRepository: FlujoPrestamosRepository,
  prestamoRepository: PrestamoRepository,
): Promise<DashboardData> {
  return Promise.allSettled([
    flujoRepository.get(periodo, periodo),
    prestamoRepository.summary({ pagina: 1, limite: 1, estados: ['ACTIVO', 'INCOBRABLE'] }),
  ]).then(([flujoResult, carteraResult]) => {
    const errors: string[] = []
    let flujo: DashboardData['flujo'] = null
    let cartera: DashboardData['cartera'] = null
    if (flujoResult.status === 'fulfilled') {
      flujo = flujoResult.value.meses.find((item) => item.periodo === periodo) ?? null
      if (!flujo) errors.push('El reporte mensual no devolvió el período solicitado.')
    } else errors.push('No se pudo cargar el flujo del mes.')
    if (carteraResult.status === 'fulfilled') cartera = carteraResult.value
    else errors.push('No se pudo cargar la cartera actual.')
    return { periodo, flujo, cartera, errors }
  })
}
