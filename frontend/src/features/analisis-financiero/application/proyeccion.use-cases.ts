import type { ProyeccionPeriodo, ProyeccionResponse } from '../domain/proyeccion.types'
export interface ProyeccionRepository { obtener(periodo: ProyeccionPeriodo): Promise<ProyeccionResponse> }
export const obtenerProyeccion = (repository: ProyeccionRepository, periodo: ProyeccionPeriodo) => repository.obtener(periodo)
