import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PLAN_PAGO_REPOSITORY, PlanPagoRepository } from '../../domain/repositories/plan-pago.repository';
import { PagoOrmEntity } from '../../../pagos/infrastructure/persistence/typeorm/pago.orm-entity';

@Injectable()
export class ListarPlanPagoUseCase {
  constructor(@Inject(PLAN_PAGO_REPOSITORY) private readonly planes: PlanPagoRepository, @InjectRepository(PagoOrmEntity) private readonly pagos: Repository<PagoOrmEntity>) {}
  async execute(prestamoId: number) {
    const planes = await this.planes.buscarPorPrestamoId(prestamoId);
    const rows = planes.length ? await this.pagos.createQueryBuilder('pago').select('pago.plan_pago_id', 'planPagoId').addSelect('COALESCE(SUM(pago.monto), 0)', 'total').addSelect('ARRAY_AGG(DISTINCT pago.fecha ORDER BY pago.fecha)', 'fechas').innerJoin('pago.planPago', 'plan').where('plan.prestamo_id = :prestamoId', { prestamoId }).andWhere('pago.plan_pago_id IS NOT NULL').groupBy('pago.plan_pago_id').getRawMany<{ planPagoId: string; total: string; fechas: string[] }>() : [];
    const byPlan = new Map(rows.map((row) => [Number(row.planPagoId), { total: Number(row.total), fechas: (row.fechas ?? []).map(String) }]));
    return planes.sort((a, b) => a.numeroPago - b.numeroPago).map((plan) => { const applied = byPlan.get(plan.id!) ?? { total: 0, fechas: [] }; const montoPagado = applied.total; const montoPendiente = Math.max(plan.montoProgramado - montoPagado, 0); return { ...plan, montoPagado, montoPendiente, estado: montoPagado <= 0 ? 'PENDIENTE' : montoPendiente <= 0 ? 'PAGADA' : 'PARCIAL', fechasPago: applied.fechas }; });
  }
}
