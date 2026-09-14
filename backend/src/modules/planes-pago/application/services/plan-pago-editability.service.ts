import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { EstadoPago } from '../../../pagos/domain/enums/estado-pago.enum';
import { PagoOrmEntity } from '../../../pagos/infrastructure/persistence/typeorm/pago.orm-entity';
import { EstadoPrestamo } from '../../../prestamos/domain/enums/estado-prestamo.enum';

export type PlanPagoEditability = {
  protegida: boolean;
  editable: boolean;
  eliminable: boolean;
};

export const calculatePlanPagoFlags = (planNumero: number, protectedIds: Set<number>, planId: number, estado: EstadoPrestamo, lastProtectedNumber: number): PlanPagoEditability => {
  const protegida = protectedIds.has(planId);
  const editable = estado === EstadoPrestamo.ACTIVO && !protegida && planNumero > lastProtectedNumber;
  return { protegida, editable, eliminable: editable };
};

export const getProtectedPlanPagoIds = (pagos: PagoOrmEntity[]): Set<number> => new Set(pagos.filter((pago) => pago.planPagoId != null).map((pago) => pago.planPagoId!));

export const getRegisteredPlanPagoTotals = (pagos: PagoOrmEntity[]): Map<number, number> => {
  const totals = new Map<number, number>();
  for (const pago of pagos) {
    if (pago.estado !== EstadoPago.REGISTRADO || pago.planPagoId == null) continue;
    totals.set(pago.planPagoId, (totals.get(pago.planPagoId) ?? 0) + Math.round(pago.monto * 100));
  }
  return totals;
};

@Injectable()
export class PlanPagoEditabilityService {
  constructor(@InjectRepository(PagoOrmEntity) private readonly pagos: Repository<PagoOrmEntity>) {}

  async listarPagos(prestamoId: number, manager: EntityManager = this.pagos.manager, lock = false): Promise<PagoOrmEntity[]> {
    const query = manager.getRepository(PagoOrmEntity).createQueryBuilder('pago')
      .where('pago.prestamo_id = :prestamoId', { prestamoId })
    if (lock) query.setLock('pessimistic_write');
    return query.getMany();
  }

  calcularFlags(planNumero: number, protectedIds: Set<number>, planId: number, estado: EstadoPrestamo, lastProtectedNumber: number): PlanPagoEditability {
    return calculatePlanPagoFlags(planNumero, protectedIds, planId, estado, lastProtectedNumber);
  }

  protectedIds(pagos: PagoOrmEntity[]): Set<number> {
    return getProtectedPlanPagoIds(pagos);
  }

  registeredTotals(pagos: PagoOrmEntity[]): Map<number, number> {
    return getRegisteredPlanPagoTotals(pagos);
  }
}
