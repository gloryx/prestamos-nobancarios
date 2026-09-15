import type { FlujoPrestamosRepository } from '../domain/flujo-prestamos.types'
export const obtenerFlujoPrestamos = (repository: FlujoPrestamosRepository, desde: string, hasta: string) => repository.get(desde, hasta)
