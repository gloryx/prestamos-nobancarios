import type { CrearMovimientoCajaInput, EstadoCaja, MovimientoCajaFilters, MovimientoCajaRepository, MovimientoCaja, MovimientosCajaPage, MovimientosCajaSummary, ReversarMovimientoCajaInput } from '../domain/movimiento-caja.types'

export const listarMovimientosCaja = (repository: MovimientoCajaRepository, filters: MovimientoCajaFilters & { pagina: number; limite: number }): Promise<MovimientosCajaPage> => repository.list(filters)
export const resumirMovimientosCaja = (repository: MovimientoCajaRepository, filters: MovimientoCajaFilters): Promise<MovimientosCajaSummary> => repository.summary(filters)
export const consultarMovimientoCaja = (repository: MovimientoCajaRepository, id: number): Promise<MovimientoCaja> => repository.getById(id)
export const obtenerEstadoCaja = (repository: MovimientoCajaRepository, fecha?: string): Promise<EstadoCaja> => repository.obtenerEstado(fecha)
export const crearMovimientoManualCaja = (repository: MovimientoCajaRepository, input: CrearMovimientoCajaInput, idempotencyKey: string): Promise<MovimientoCaja> => repository.createManual(input, idempotencyKey)
export const reversarMovimientoCaja = (repository: MovimientoCajaRepository, id: number, input: ReversarMovimientoCajaInput): Promise<MovimientoCaja> => repository.reverse(id, input)
