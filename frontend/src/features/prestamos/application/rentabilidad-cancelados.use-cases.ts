import type { RentabilidadCanceladosRepository } from '../domain/rentabilidad-cancelados.types'

export const obtenerRentabilidadCancelados = (repository: RentabilidadCanceladosRepository, anio: number, mes: number) => repository.report(anio, mes)
