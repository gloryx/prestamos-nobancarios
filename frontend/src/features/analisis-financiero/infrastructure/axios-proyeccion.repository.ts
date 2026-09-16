import { apiClient } from '@/core/api/client'
import type { ProyeccionPeriodo, ProyeccionResponse } from '../domain/proyeccion.types'
import type { ProyeccionRepository } from '../application/proyeccion.use-cases'
export class AxiosProyeccionRepository implements ProyeccionRepository { async obtener(periodo: ProyeccionPeriodo) { return (await apiClient.get<ProyeccionResponse>('/analisis-financiero/proyeccion', { params: { periodo } })).data } }
