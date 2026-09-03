import { FormaPago } from '../../../domain/entities/forma-pago';
import { FormaPagoOrmEntity } from './forma-pago.orm-entity';

export class FormaPagoMapper {
  static toDomain(entity: FormaPagoOrmEntity): FormaPago {
    return new FormaPago(entity.id, entity.nombre, entity.activo);
  }

  static toOrm(domain: FormaPago): FormaPagoOrmEntity {
    const orm = new FormaPagoOrmEntity();

    if (domain.id !== null) {
    orm.id = domain.id;
  }
    orm.nombre = domain.nombre;
    orm.activo = domain.activo;

    return orm;
  }
}
