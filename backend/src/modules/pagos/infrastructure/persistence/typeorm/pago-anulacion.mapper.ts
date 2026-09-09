import { PagoAnulacion } from '../../../domain/entities/pago-anulacion';
import { PagoAnulacionOrmEntity } from './pago-anulacion.orm-entity';

export class PagoAnulacionMapper {
  static toDomain(entity: PagoAnulacionOrmEntity): PagoAnulacion {
    return new PagoAnulacion(entity.id, entity.pagoId, new Date(`${entity.fecha}T00:00:00.000Z`), entity.usuarioId, entity.motivo, entity.observacion, entity.fechaCreacion, entity.usuario && { id: entity.usuario.id, nombreCompleto: entity.usuario.nombreCompleto });
  }

  static toOrm(domain: PagoAnulacion): PagoAnulacionOrmEntity {
    const entity = new PagoAnulacionOrmEntity();
    if (domain.id !== null) entity.id = domain.id;
    entity.pagoId = domain.pagoId; entity.fecha = domain.fecha.toISOString().slice(0, 10); entity.usuarioId = domain.usuarioId; entity.motivo = domain.motivo; entity.observacion = domain.observacion?.trim() || null;
    return entity;
  }
}
