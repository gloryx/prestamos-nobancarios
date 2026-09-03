import { PeriodicidadPago } from '../../../domain/entities/periodicidad-pago';
import { PeriodicidadPagoOrmEntity } from './periodicidad-pago.orm-entity';

export class PeriodicidadPagoMapper {
  static toDomain(entity: PeriodicidadPagoOrmEntity): PeriodicidadPago {
    return new PeriodicidadPago(entity.id, entity.nombre, entity.activo);
  }

  static toOrm(domain: PeriodicidadPago): PeriodicidadPagoOrmEntity {
    const orm = new PeriodicidadPagoOrmEntity();

    if (domain.id !== null) {
      orm.id = domain.id;
    }
    orm.nombre = domain.nombre;
    orm.activo = domain.activo;

    return orm;
  }
}
