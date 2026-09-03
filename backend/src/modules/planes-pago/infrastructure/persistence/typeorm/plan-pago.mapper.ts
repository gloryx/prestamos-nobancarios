import { PlanPago } from '../../../domain/entities/plan-pago';
import { PlanPagoOrmEntity } from './plan-pago.orm-entity';

const dateFromDb = (value: string | Date): Date => value instanceof Date ? new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())) : new Date(`${value}T00:00:00.000Z`);
const dateToDb = (value: Date): string => value.toISOString().slice(0, 10);

export class PlanPagoMapper {
  static toDomain(entity: PlanPagoOrmEntity): PlanPago { return new PlanPago(entity.id, entity.prestamoId, entity.numeroPago, dateFromDb(entity.fechaVencimiento), entity.montoProgramado, entity.fechaCreacion); }
  static toOrm(domain: PlanPago): PlanPagoOrmEntity {
    const entity = new PlanPagoOrmEntity();
    if (domain.id !== null) entity.id = domain.id;
    entity.prestamoId = domain.prestamoId; entity.numeroPago = domain.numeroPago; entity.fechaVencimiento = dateToDb(domain.fechaVencimiento); entity.montoProgramado = domain.montoProgramado;
    return entity;
  }
}
