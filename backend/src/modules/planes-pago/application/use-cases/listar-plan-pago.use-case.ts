import { Inject, Injectable } from '@nestjs/common';
import { PLAN_PAGO_REPOSITORY, PlanPagoRepository } from '../../domain/repositories/plan-pago.repository';

@Injectable()
export class ListarPlanPagoUseCase {
  constructor(@Inject(PLAN_PAGO_REPOSITORY) private readonly planes: PlanPagoRepository) {}
  execute(prestamoId: number) { return this.planes.buscarPorPrestamoId(prestamoId); }
}
