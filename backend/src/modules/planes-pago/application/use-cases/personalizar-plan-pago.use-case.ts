import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EstadoPago } from '../../../pagos/domain/enums/estado-pago.enum';
import { PagoOrmEntity } from '../../../pagos/infrastructure/persistence/typeorm/pago.orm-entity';
import { EstadoPrestamo } from '../../../prestamos/domain/enums/estado-prestamo.enum';
import { PrestamoOrmEntity } from '../../../prestamos/infrastructure/persistence/typeorm/prestamo.orm-entity';
import { PlanPagoOrmEntity } from '../../infrastructure/persistence/typeorm/plan-pago.orm-entity';
import { PersonalizarPlanPagoDto } from '../dto/plan-pago-personalizado.dto';
import { validarFechaVencimientoPlan } from './validar-plan-pago';
import { calculatePlanPagoFlags, getProtectedPlanPagoIds, getRegisteredPlanPagoTotals, getPlanPagoPendingCents, getTotalPlanOperativoPendienteCents, PlanPagoEditabilityService } from '../services/plan-pago-editability.service';

const cents = (value: number) => Math.round(value * 100);
const money = (value: number) => cents(value) / 100;
const dateText = (value: string | Date) => value instanceof Date ? value.toISOString().slice(0, 10) : value;

@Injectable()
export class PersonalizarPlanPagoUseCase {
  constructor(@InjectDataSource() private readonly dataSource: DataSource, @Optional() private readonly editability?: PlanPagoEditabilityService) {}

  async execute(prestamoId: number, dto: PersonalizarPlanPagoDto) {
    return this.dataSource.transaction(async (manager) => {
      const loan = await manager.getRepository(PrestamoOrmEntity).createQueryBuilder('prestamo')
        .where('prestamo.id = :id', { id: prestamoId }).setLock('pessimistic_write').getOne();
      if (!loan) throw new NotFoundException('Préstamo no encontrado.');
      if (loan.estado !== EstadoPrestamo.ACTIVO) throw new BadRequestException('Solo se puede personalizar el plan de un préstamo activo.');
       if (!Array.isArray(dto.cuotas)) throw new BadRequestException('El plan de pago debe contener cuotas.');

      const planRepository = manager.getRepository(PlanPagoOrmEntity);
      const plans = await planRepository.createQueryBuilder('plan')
        .where('plan.prestamo_id = :prestamoId', { prestamoId })
        .orderBy('plan.numero_pago', 'ASC').addOrderBy('plan.id', 'ASC')
        .setLock('pessimistic_write').getMany();
      if (!plans.length) throw new NotFoundException('Plan de pago no encontrado.');

      // The model has no separate historical-installment flag: a plan row is
      // immutable for this operation exactly when any payment references it.
      const payments = this.editability ? await this.editability.listarPagos(prestamoId, manager, true) : await manager.getRepository(PagoOrmEntity).createQueryBuilder('pago').where('pago.prestamo_id = :prestamoId', { prestamoId }).setLock('pessimistic_write').getMany();
      const registeredByPlan = this.editability?.registeredTotals(payments) ?? getRegisteredPlanPagoTotals(payments);
      const protectedIds = this.editability?.protectedIds(payments) ?? getProtectedPlanPagoIds(payments);
      let registeredTotal = 0;
      // Payments without a plan reference still count toward the financial
      // balance, but cannot protect or be attached to a different installment.
      registeredTotal = payments.filter((payment) => payment.estado === EstadoPago.REGISTRADO)
        .reduce((sum, payment) => sum + cents(payment.monto), 0);
      const balance = Math.max(0, cents(loan.montoTotal) - registeredTotal);

      const byId = new Map(plans.map((plan) => [plan.id, plan]));
      const lastProtectedNumber = plans.filter((plan) => protectedIds.has(plan.id)).at(-1)?.numeroPago ?? 0;
      const editable = plans.filter((plan) => !protectedIds.has(plan.id) && plan.numeroPago > lastProtectedNumber);
      const preservedBeforeEditable = plans.filter((plan) => plan.numeroPago <= lastProtectedNumber && !protectedIds.has(plan.id));
      const submittedIds = new Set<number>();
      for (const item of dto.cuotas ?? []) {
        if (item.id !== undefined) {
          if (submittedIds.has(item.id)) throw new BadRequestException('No se pueden repetir cuotas en la propuesta.');
          submittedIds.add(item.id);
           const plan = byId.get(item.id);
           if (!plan) throw new BadRequestException('La cuota no pertenece al préstamo.');
           if (protectedIds.has(item.id)) throw new BadRequestException('Las cuotas con pagos históricos no pueden modificarse.');
           if (plan.numeroPago <= lastProtectedNumber) throw new BadRequestException('Solo se puede personalizar la parte futura del plan.');
        }
      }
      const lastProtected = plans.filter((plan) => protectedIds.has(plan.id)).at(-1);
      const originalLastDate = dateText(plans.at(-1).fechaVencimiento);
      const proposal = (dto.cuotas ?? []).map((item) => ({ item, plan: item.id === undefined ? undefined : byId.get(item.id) }));
      let previous: string | Date = lastProtected ? dateText(lastProtected.fechaVencimiento) : dateText(loan.fechaAlta);
      let proposedTotal = 0;
      for (const { item } of proposal) {
        validarFechaVencimientoPlan(item.fechaVencimiento, loan.fechaAlta, previous);
        if (item.id === undefined && item.fechaVencimiento <= originalLastDate) {
          throw new BadRequestException('Las nuevas cuotas deben tener fechas posteriores al plan original.');
        }
        previous = item.fechaVencimiento;
        proposedTotal += cents(item.montoProgramado);
      }
      if (proposedTotal !== balance) throw new BadRequestException('La suma de las cuotas futuras editables debe coincidir con el saldo financiero pendiente.');

      const omitted = editable.filter((plan) => !submittedIds.has(plan.id));
      const temporaryBase = Math.max(...plans.map((plan) => plan.numeroPago), 0) + 1_000_000;
      for (let index = 0; index < editable.length; index += 1) editable[index].numeroPago = temporaryBase + index;
      if (editable.length) await planRepository.save(editable);
      if (omitted.length) await planRepository.remove(omitted);

      const finalEntities: PlanPagoOrmEntity[] = [];
      for (let index = 0; index < proposal.length; index += 1) {
        const { item, plan } = proposal[index];
        const entity = plan ?? planRepository.create({ prestamoId, numeroPago: 0, fechaVencimiento: item.fechaVencimiento, montoProgramado: money(item.montoProgramado) });
        entity.prestamoId = prestamoId;
        entity.numeroPago = lastProtectedNumber + index + 1;
        entity.fechaVencimiento = item.fechaVencimiento;
        entity.montoProgramado = money(item.montoProgramado);
        finalEntities.push(entity);
      }
      if (finalEntities.length) await planRepository.save(finalEntities);

      const all = [...preservedBeforeEditable, ...plans.filter((plan) => protectedIds.has(plan.id)), ...finalEntities].sort((a, b) => a.numeroPago - b.numeroPago);
      return {
        saldoPendiente: balance / 100,
        totalPlanOperativoPendiente: getTotalPlanOperativoPendienteCents(all, registeredByPlan as Map<number, number>) / 100,
        cuotas: all.map((plan) => {
          const paid = registeredByPlan.get(plan.id) ?? 0;
           const flags = this.editability?.calcularFlags(plan.numeroPago, protectedIds, plan.id!, loan.estado, lastProtectedNumber) ?? calculatePlanPagoFlags(plan.numeroPago, protectedIds, plan.id!, loan.estado, lastProtectedNumber);
             const pending = getPlanPagoPendingCents(plan, registeredByPlan as Map<number, number>);
             return { id: plan.id, numeroPago: plan.numeroPago, fechaVencimiento: dateText(plan.fechaVencimiento), montoProgramado: plan.montoProgramado, montoPagado: paid / 100, montoPendiente: pending / 100, estado: paid > 0 ? 'PAGADA' : 'PENDIENTE', ...flags };
        }),
      };
    });
  }
}
