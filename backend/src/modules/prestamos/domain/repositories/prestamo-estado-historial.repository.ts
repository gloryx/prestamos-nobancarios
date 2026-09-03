import { EntityManager } from 'typeorm';
import { PrestamoEstadoHistorial } from '../entities/prestamo-estado-historial';
import { EstadoPrestamo } from '../enums/estado-prestamo.enum';

export type EstadoHistorico = EstadoPrestamo | 'DESCONOCIDO';
export interface PrestamoEstadoHistorialRepository {
  guardarEnTransaccion(manager: EntityManager, historial: PrestamoEstadoHistorial): Promise<PrestamoEstadoHistorial>;
  listarPorPrestamo(prestamoId: number): Promise<PrestamoEstadoHistorial[]>;
  estadoDelPrestamoEnFecha(manager: EntityManager, prestamoId: number, fecha: Date): Promise<EstadoHistorico>;
}
export const PRESTAMO_ESTADO_HISTORIAL_REPOSITORY = Symbol('PRESTAMO_ESTADO_HISTORIAL_REPOSITORY');
