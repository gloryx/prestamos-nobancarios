import type { CobrosDelDiaResponse } from './cobros-del-dia.types'

export interface CobrosDelDiaRepository {
  consultar(fecha: string): Promise<CobrosDelDiaResponse>
}
