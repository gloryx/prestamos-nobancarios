import { Prestamo } from '../../../domain/entities/prestamo';
import { PrestamoConRelaciones, PrestamoRelacion } from '../../../domain/repositories/prestamo.repository';
import { EstadoPrestamo } from '../../../domain/enums/estado-prestamo.enum';
import { PrestamoOrmEntity } from './prestamo.orm-entity';

const dateFromDb = (value: string | Date): Date => value instanceof Date ? new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())) : new Date(`${value}T00:00:00.000Z`);
const dateToDb = (value: Date): string => value.toISOString().slice(0, 10);
const relation = (value: PrestamoRelacion): PrestamoRelacion => value;

export class PrestamoMapper {
  static toDomain(entity: PrestamoOrmEntity): PrestamoConRelaciones {
    const domain = new Prestamo(entity.id, entity.clienteId, entity.periodicidadPagoId, entity.formaPagoId, entity.formaDesembolsoId, dateFromDb(entity.fechaAlta), entity.capital, entity.interes, entity.montoTotal, entity.montoDesembolsado, entity.cantidadPagos, entity.planPersonalizado, entity.estado as EstadoPrestamo, entity.observaciones, entity.fechaCreacion, entity.fechaActualizacion);
    return Object.assign(domain, {
      cliente: relation({ id: entity.cliente.id, nombre: [entity.cliente.primerNombre, entity.cliente.segundoNombre, entity.cliente.primerApellido, entity.cliente.segundoApellido].filter((value): value is string => Boolean(value)).join(' '), identificacion: entity.cliente.identificacion, direccion: entity.cliente.direccion }),
      periodicidadPago: relation({ id: entity.periodicidadPago.id, nombre: entity.periodicidadPago.nombre }),
      formaPago: relation({ id: entity.formaPago.id, nombre: entity.formaPago.nombre }),
      formaDesembolso: entity.formaDesembolso ? relation({ id: entity.formaDesembolso.id, nombre: entity.formaDesembolso.nombre }) : null,
    });
  }
  static toOrm(domain: Prestamo): PrestamoOrmEntity {
    const entity = new PrestamoOrmEntity();
    if (domain.id !== null) entity.id = domain.id;
    entity.clienteId = domain.clienteId; entity.periodicidadPagoId = domain.periodicidadPagoId; entity.formaPagoId = domain.formaPagoId; entity.formaDesembolsoId = domain.formaDesembolsoId;
    entity.fechaAlta = dateToDb(domain.fechaAlta); entity.capital = domain.capital; entity.interes = domain.interes; entity.montoTotal = domain.montoTotal;
    entity.montoDesembolsado = domain.montoDesembolsado; entity.cantidadPagos = domain.cantidadPagos; entity.planPersonalizado = domain.planPersonalizado;
    entity.estado = domain.estado; entity.observaciones = domain.observaciones;
    return entity;
  }
}
