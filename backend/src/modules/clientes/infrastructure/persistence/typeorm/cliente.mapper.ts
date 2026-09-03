import { Cliente } from '../../../domain/entities/cliente';
import { Nacionalidad } from '../../../domain/enums/nacionalidad.enum';
import { ClienteOrmEntity } from './cliente.orm-entity';

const dateFromDb = (value: string | Date | null): Date | null => value ? (value instanceof Date ? new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())) : new Date(`${value}T00:00:00.000Z`)) : null;
const dateToDb = (value: Date | null): string | null => value ? value.toISOString().slice(0, 10) : null;

export class ClienteMapper {
  static toDomain(entity: ClienteOrmEntity): Cliente {
    return new Cliente(entity.id, entity.identificacion, entity.primerNombre, entity.segundoNombre, entity.primerApellido, entity.segundoApellido, entity.genero, dateFromDb(entity.fechaNacimiento), entity.direccion, entity.correo, entity.telefono1, entity.telefono2, entity.nacionalidad as Nacionalidad | null, entity.observaciones, entity.fechaIngreso, entity.urlIdentificacion, entity.activo);
  }

  static toOrm(domain: Cliente): ClienteOrmEntity {
    const entity = new ClienteOrmEntity();
    if (domain.id !== null) entity.id = domain.id;
    entity.identificacion = domain.identificacion;
    entity.primerNombre = domain.primerNombre;
    entity.segundoNombre = domain.segundoNombre;
    entity.primerApellido = domain.primerApellido;
    entity.segundoApellido = domain.segundoApellido;
    entity.genero = domain.genero;
    entity.fechaNacimiento = dateToDb(domain.fechaNacimiento);
    entity.direccion = domain.direccion;
    entity.correo = domain.correo;
    entity.telefono1 = domain.telefono1;
    entity.telefono2 = domain.telefono2;
    entity.nacionalidad = domain.nacionalidad;
    entity.observaciones = domain.observaciones;
    entity.fechaIngreso = domain.fechaIngreso;
    entity.urlIdentificacion = domain.urlIdentificacion;
    entity.activo = domain.activo;
    return entity;
  }
}
