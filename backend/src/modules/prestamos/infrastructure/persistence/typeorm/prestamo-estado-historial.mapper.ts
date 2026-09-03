import { PrestamoEstadoHistorial } from '../../../domain/entities/prestamo-estado-historial';
import { EstadoPrestamo } from '../../../domain/enums/estado-prestamo.enum';
import { PrestamoEstadoHistorialOrmEntity } from './prestamo-estado-historial.orm-entity';

export class PrestamoEstadoHistorialMapper {
  static toDomain(entity: PrestamoEstadoHistorialOrmEntity): PrestamoEstadoHistorial {
    return new PrestamoEstadoHistorial(entity.id, entity.prestamoId, entity.estadoAnterior as EstadoPrestamo | null, entity.estadoNuevo as EstadoPrestamo, new Date(`${entity.fecha}T00:00:00.000Z`), entity.usuarioId, entity.observacion, entity.fechaCreacion, entity.usuario && { id: entity.usuario.id, nombreCompleto: entity.usuario.nombreCompleto });
  }
  static toOrm(domain: PrestamoEstadoHistorial): PrestamoEstadoHistorialOrmEntity {
    const entity = new PrestamoEstadoHistorialOrmEntity();
    if (domain.id !== null) entity.id = domain.id;
    entity.prestamoId = domain.prestamoId; entity.estadoAnterior = domain.estadoAnterior; entity.estadoNuevo = domain.estadoNuevo;
    entity.fecha = domain.fecha.toISOString().slice(0, 10); entity.usuarioId = domain.usuarioId; entity.observacion = domain.observacion?.trim() || null;
    return entity;
  }
}
