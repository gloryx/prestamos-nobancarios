import type { CobrosDelDiaRepository } from '../domain/cobros-del-dia.repository'
import type { CobrosDelDiaResponse } from '../domain/cobros-del-dia.types'

export const consultarCobrosDelDia = (repository: CobrosDelDiaRepository, fecha: string): Promise<CobrosDelDiaResponse> => repository.consultar(fecha)
