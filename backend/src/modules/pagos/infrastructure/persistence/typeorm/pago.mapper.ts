import { Pago } from '../../../domain/entities/pago';
import { PagoConRelaciones, PrestamoPagoRelacion } from '../../../domain/repositories/pago.repository';
import { PagoOrmEntity } from './pago.orm-entity';

const dateFromDb = (value: string | Date): Date => value instanceof Date ? new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())) : new Date(`${value}T00:00:00.000Z`);
const dateToDb = (value: Date): string => value.toISOString().slice(0, 10);
export class PagoMapper {
  static toDomain(entity: PagoOrmEntity): PagoConRelaciones {
    const pago = new Pago(entity.id, entity.prestamoId, entity.formaPagoId, entity.monto, entity.capitalAplicado, entity.interesAplicado, entity.cobradorId, dateFromDb(entity.fecha), entity.observaciones, entity.fechaCreacion, entity.planPagoId, entity.redistribuyoPlan, entity.estado);
    const audit = entity.anulacion;
    const compatibility = audit ? { fechaAnulacion: new Date(`${audit.fecha}T00:00:00.000Z`), usuarioAnulacionId: audit.usuarioId, motivoAnulacion: audit.motivo, observacionAnulacion: audit.observacion } : { fechaAnulacion: null, usuarioAnulacionId: null, motivoAnulacion: null, observacionAnulacion: null };
    if (!entity.formaPago || !entity.prestamo) return Object.assign(pago, compatibility, { planPagoId: entity.planPagoId, numeroCuota: entity.planPago?.numeroPago ?? null }) as PagoConRelaciones;
    return Object.assign(pago, compatibility, { formaPago: { id: entity.formaPago.id, nombre: entity.formaPago.nombre }, prestamo: { id: entity.prestamo.id, estado: entity.prestamo.estado, capital: entity.prestamo.capital, interes: entity.prestamo.interes, montoTotal: entity.prestamo.montoTotal } as PrestamoPagoRelacion, cliente: entity.prestamo.cliente ? { id: entity.prestamo.cliente.id, identificacion: entity.prestamo.cliente.identificacion, nombreCompleto: [entity.prestamo.cliente.primerNombre, entity.prestamo.cliente.segundoNombre, entity.prestamo.cliente.primerApellido, entity.prestamo.cliente.segundoApellido].filter(Boolean).join(' ') } : undefined, cobrador: entity.cobrador ? { id: entity.cobrador.id, identificacion: entity.cobrador.identificacion, nombreCompleto: entity.cobrador.nombreCompleto, telefono: entity.cobrador.telefono, correo: entity.cobrador.correo } : { id: entity.cobradorId, identificacion: '', nombreCompleto: '', telefono: null, correo: null }, planPagoId: entity.planPagoId, numeroCuota: entity.planPago?.numeroPago ?? null }) as PagoConRelaciones;
  }
  static toOrm(domain: Pago): PagoOrmEntity {
    const entity = new PagoOrmEntity();
    if (domain.id !== null) entity.id = domain.id;
    entity.prestamoId = domain.prestamoId; entity.formaPagoId = domain.formaPagoId; entity.planPagoId = domain.planPagoId; entity.redistribuyoPlan = domain.redistribuyoPlan; entity.monto = domain.monto; entity.capitalAplicado = domain.capitalAplicado; entity.interesAplicado = domain.interesAplicado; entity.cobradorId = domain.cobradorId; entity.fecha = dateToDb(domain.fecha); entity.observaciones = domain.observaciones; entity.estado = domain.estado;
    return entity;
  }
}
