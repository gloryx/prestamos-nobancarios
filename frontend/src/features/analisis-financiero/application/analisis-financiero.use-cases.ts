import type { AnalisisFinancieroRepository } from '../domain/analisis-financiero.types'

export const obtenerResumenMensual = (repository: AnalisisFinancieroRepository, anio: number) => repository.obtenerResumenMensual(anio)
export const obtenerComparativoAnual = (repository: AnalisisFinancieroRepository, desde: number, hasta: number) => repository.obtenerComparativoAnual(desde, hasta)
