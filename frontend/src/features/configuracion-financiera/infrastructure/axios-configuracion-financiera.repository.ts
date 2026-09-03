import { apiClient } from '@/core/api/client'
import type { ConfiguracionFinanciera, ConfiguracionFinancieraRepository, CrearConfiguracionFinanciera, VistaPreviaCartera } from '../domain/configuracion-financiera.types'

export class ApiConfiguracionFinancieraRepository implements ConfiguracionFinancieraRepository {
  async obtener() {
    const response = await apiClient.get<ConfiguracionFinanciera | null>('/configuracion-financiera')
    return response.data
  }

  async obtenerVistaPrevia(fecha: string) {
    const response = await apiClient.get<VistaPreviaCartera>('/configuracion-financiera/vista-previa', { params: { fecha } })
    return response.data
  }

  async crear(input: CrearConfiguracionFinanciera) {
    const response = await apiClient.post<ConfiguracionFinanciera>('/configuracion-financiera', input)
    return response.data
  }
}
