import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PLAN_PAGO_REPOSITORY, PlanPagoRepository } from '../../domain/repositories/plan-pago.repository';
import { PrestamoOrmEntity } from '../../../prestamos/infrastructure/persistence/typeorm/prestamo.orm-entity';
import { EstadoPrestamo } from '../../../prestamos/domain/enums/estado-prestamo.enum';
import { PlanPagoEditabilityService } from '../services/plan-pago-editability.service';
import { dateOnly } from '../services/date-only';

@Injectable()
export class ListarPlanPagoUseCase {
  constructor(@Inject(PLAN_PAGO_REPOSITORY) private readonly planes: PlanPagoRepository, @InjectRepository(PrestamoOrmEntity) private readonly prestamos: Repository<PrestamoOrmEntity>, private readonly editability: PlanPagoEditabilityService) {}
  async execute(prestamoId: number) {
    const planes = await this.planes.buscarPorPrestamoId(prestamoId);
    const [prestamo, pagos] = await Promise.all([this.prestamos.findOne({ where: { id: prestamoId }, select: { id: true, estado: true } }), planes.length ? this.editability.listarPagos(prestamoId) : Promise.resolve([])]);
    const protectedIds = this.editability.protectedIds(pagos);
    const registeredTotals = this.editability.registeredTotals(pagos);
    const datesByPlan = new Map<number, string[]>();
    for (const pago of pagos) {
      if (pago.estado !== 'REGISTRADO' || pago.planPagoId == null) continue;
      const dates = datesByPlan.get(pago.planPagoId) ?? [];
      const date = dateOnly(pago.fecha);
      if (!dates.includes(date)) dates.push(date);
      datesByPlan.set(pago.planPagoId, dates);
    }
    const lastProtectedNumber = planes.filter((plan) => protectedIds.has(plan.id!)).at(-1)?.numeroPago ?? 0;
    return planes.sort((a, b) => a.numeroPago - b.numeroPago).map((plan) => { const montoPagado = (registeredTotals.get(plan.id!) ?? 0) / 100; const estaPagada = montoPagado > 0; const montoPendiente = estaPagada ? 0 : plan.montoProgramado; return { ...plan, montoPagado, montoPendiente, estado: estaPagada ? 'PAGADA' : 'PENDIENTE', fechasPago: datesByPlan.get(plan.id!) ?? [], ...this.editability.calcularFlags(plan.numeroPago, protectedIds, plan.id!, prestamo?.estado ?? EstadoPrestamo.ACTIVO, lastProtectedNumber) }; });
  }
}
