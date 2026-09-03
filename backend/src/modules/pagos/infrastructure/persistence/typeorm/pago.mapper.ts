import { Pago } from '../../../domain/entities/pago';
import { PagoConRelaciones, PagoRelacion, PrestamoPagoRelacion } from '../../../domain/repositories/pago.repository';
import { PagoOrmEntity } from './pago.orm-entity';

const dateFromDb = (value: string | Date): Date => value instanceof Date ? new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())) : new Date(`${value}T00:00:00.000Z`);
const dateToDb = (value: Date): string => value.toISOString().slice(0, 10);
const relation = <T>(value: T): T => value;

export class PagoMapper {
  static toDomain(entity: PagoOrmEntity): PagoConRelaciones {
    const pago = new Pago(entity.id, entity.prestamoId, entity.formaPagoId, entity.monto, entity.capitalAplicado, entity.interesAplicado, entity.cobradorId, dateFromDb(entity.fecha), entity.observaciones, entity.fechaCreacion);
    if (!entity.formaPago || !entity.prestamo) return pago as PagoConRelaciones;
    return Object.assign(pago, {
      formaPago: relation({ id: entity.formaPago.id, nombre: entity.formaPago.nombre }),
       prestamo: relation<PrestamoPagoRelacion>({ id: entity.prestamo.id, estado: entity.prestamo.estado, capital: entity.prestamo.capital, interes: entity.prestamo.interes, montoTotal: entity.prestamo.montoTotal }),
      cliente: entity.prestamo.cliente ? relation({ id: entity.prestamo.cliente.id, identificacion: entity.prestamo.cliente.identificacion, nombreCompleto: [entity.prestamo.cliente.primerNombre, entity.prestamo.cliente.segundoNombre, entity.prestamo.cliente.primerApellido, entity.prestamo.cliente.segundoApellido].filter(Boolean).join(' ') }) : undefined,
       cobrador: entity.cobrador ? relation({ id: entity.cobrador.id, identificacion: entity.cobrador.identificacion, nombreCompleto: entity.cobrador.nombreCompleto, telefono: entity.cobrador.telefono, correo: entity.cobrador.correo }) : relation({ id: entity.cobradorId, identificacion: '', nombreCompleto: '', telefono: null, correo: null }),
     });
  }
  static toOrm(domain: Pago): PagoOrmEntity {
    const entity = new PagoOrmEntity();
    if (domain.id !== null) entity.id = domain.id;
      entity.prestamoId = domain.prestamoId; entity.formaPagoId = domain.formaPagoId; entity.monto = domain.monto; entity.capitalAplicado = domain.capitalAplicado; entity.interesAplicado = domain.interesAplicado; entity.cobradorId = domain.cobradorId; entity.fecha = dateToDb(domain.fecha); entity.observaciones = domain.observaciones;
    return entity;
  }
}
