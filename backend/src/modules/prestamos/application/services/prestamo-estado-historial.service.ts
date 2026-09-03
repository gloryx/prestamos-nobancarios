import { Inject, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { EstadoPrestamo } from '../../domain/enums/estado-prestamo.enum';
import { PrestamoEstadoHistorial } from '../../domain/entities/prestamo-estado-historial';
import { PRESTAMO_ESTADO_HISTORIAL_REPOSITORY, PrestamoEstadoHistorialRepository } from '../../domain/repositories/prestamo-estado-historial.repository';

@Injectable()
export class PrestamoEstadoHistorialService {
  constructor(@Inject(PRESTAMO_ESTADO_HISTORIAL_REPOSITORY) private readonly repository: PrestamoEstadoHistorialRepository) {}
  registrar(manager: EntityManager, prestamoId: number, estadoAnterior: EstadoPrestamo | null, estadoNuevo: EstadoPrestamo, fecha: Date, usuarioId: number, observacion?: string | null) {
    return this.repository.guardarEnTransaccion(manager, new PrestamoEstadoHistorial(null, prestamoId, estadoAnterior, estadoNuevo, fecha, usuarioId, observacion?.trim() || null, new Date()));
  }
  listar(prestamoId: number) { return this.repository.listarPorPrestamo(prestamoId); }
  estadoDelPrestamoEnFecha(manager: EntityManager, prestamoId: number, fecha: Date) { return this.repository.estadoDelPrestamoEnFecha(manager, prestamoId, fecha); }
}
