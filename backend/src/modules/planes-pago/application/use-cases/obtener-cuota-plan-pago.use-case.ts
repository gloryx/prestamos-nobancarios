import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PLAN_PAGO_REPOSITORY, PlanPagoRepository } from '../../domain/repositories/plan-pago.repository';

@Injectable()
export class ObtenerCuotaPlanPagoUseCase {
  constructor(@Inject(PLAN_PAGO_REPOSITORY) private readonly planes: PlanPagoRepository) {}
  async execute(id: number) { const plan = await this.planes.buscarPorId(id); if (!plan) throw new NotFoundException('Cuota del plan de pago no encontrada.'); return plan; }
}
