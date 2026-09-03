import { PlanPago } from '../entities/plan-pago';
import { EntityManager } from 'typeorm';

export interface PlanPagoRepository {
  guardarMuchos(planes: PlanPago[], prestamoId: number, planPersonalizado: boolean): Promise<PlanPago[]>;
  guardarMuchosEnTransaccion(manager: EntityManager, planes: PlanPago[], prestamoId: number, planPersonalizado: boolean): Promise<PlanPago[]>;
  buscarPorPrestamoId(prestamoId: number): Promise<PlanPago[]>;
  buscarPorId(id: number): Promise<PlanPago | null>;
  existePlanParaPrestamo(prestamoId: number): Promise<boolean>;
  reemplazarPlan(planes: PlanPago[], prestamoId: number): Promise<PlanPago[]>;
}

export const PLAN_PAGO_REPOSITORY = Symbol('PLAN_PAGO_REPOSITORY');
