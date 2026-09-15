import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { EstadoPago } from '../../../pagos/domain/enums/estado-pago.enum';
import { PagoOrmEntity } from '../../../pagos/infrastructure/persistence/typeorm/pago.orm-entity';
import { EstadoPrestamo } from '../../../prestamos/domain/enums/estado-prestamo.enum';
import { PlanPago } from '../../domain/entities/plan-pago';

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

/**
 * A registered payment closes the operational installment. Any shortfall has
 * already been redistributed to a later installment by the payment flow, so
 * counting it again here would duplicate the operational debt. Annulled
 * payments are deliberately absent from registeredTotals.
 */
export const getPlanPagoPendingCents = (plan: Pick<PlanPago, 'id' | 'montoProgramado'>, registeredTotals: Map<number, number>): number =>
  (registeredTotals.get(plan.id!) ?? 0) > 0 ? 0 : Math.round(plan.montoProgramado * 100);

export const getTotalPlanOperativoPendienteCents = (planes: Array<Pick<PlanPago, 'id' | 'montoProgramado'>>, registeredTotals: Map<number, number>): number =>
  planes.reduce((total, plan) => total + getPlanPagoPendingCents(plan, registeredTotals), 0);

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

  totalPlanOperativoPendiente(planes: PlanPago[], pagos: PagoOrmEntity[]): number {
    return getTotalPlanOperativoPendienteCents(planes, this.registeredTotals(pagos));
  }

  montoPendiente(plan: PlanPago, pagos: PagoOrmEntity[]): number {
    return getPlanPagoPendingCents(plan, this.registeredTotals(pagos));
  }
}
