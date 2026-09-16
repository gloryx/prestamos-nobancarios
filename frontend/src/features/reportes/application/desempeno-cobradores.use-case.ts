import type { DesempenoCobradoresRepository } from '../domain/desempeno-cobradores.types'
export const obtenerDesempenoCobradores = (repository: DesempenoCobradoresRepository, filters: Parameters<DesempenoCobradoresRepository['get']>[0]) => repository.get(filters)
