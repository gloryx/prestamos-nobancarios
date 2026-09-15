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
import { calculatePlanPagoFlags, getLastOperationalNumber, getLastProtectedNumber, getProtectedPlanPagoIds, getRegisteredPlanPagoTotals, getPlanPagoPendingCents, getTotalPlanOperativoPendienteCents, PlanPagoEditabilityService } from '../services/plan-pago-editability.service';

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
       const lastProtectedNumber = getLastProtectedNumber(plans, protectedIds);
       const lastOperationalNumber = getLastOperationalNumber(plans, protectedIds);
       const flagsFor = (plan: PlanPagoOrmEntity) => this.editability?.calcularFlags(plan.numeroPago, protectedIds, plan.id!, loan.estado, lastProtectedNumber, lastOperationalNumber)
         ?? calculatePlanPagoFlags(plan.numeroPago, protectedIds, plan.id!, loan.estado, lastProtectedNumber, lastOperationalNumber);
       const editable = plans.filter((plan) => flagsFor(plan).editable);
        const dateOnly = plans.find((plan) => plan.numeroPago === lastOperationalNumber && flagsFor(plan).puedeEditarFecha && !flagsFor(plan).editable);
       const submittedIds = new Set<number>();
       for (const item of dto.cuotas ?? []) {
         if (item.id !== undefined) {
          if (submittedIds.has(item.id)) throw new BadRequestException('No se pueden repetir cuotas en la propuesta.');
          submittedIds.add(item.id);
           const plan = byId.get(item.id);
           if (!plan) throw new BadRequestException('La cuota no pertenece al préstamo.');
            const flags = flagsFor(plan);
            if (!flags.editable && !flags.puedeEditarFecha) throw new BadRequestException('Las cuotas con pagos históricos no pueden modificarse.');
            if (!flags.editable && item.montoProgramado !== undefined && cents(item.montoProgramado) !== cents(plan.montoProgramado)) throw new BadRequestException('El monto de una cuota protegida no puede modificarse.');
            if (item.numeroPago !== undefined && item.numeroPago !== plan.numeroPago) throw new BadRequestException('El número original de la cuota no coincide.');
         }
       }
        const originalLastDate = dateText(plans.reduce((last, plan) => plan.numeroPago > last.numeroPago ? plan : last).fechaVencimiento);
       const proposal = (dto.cuotas ?? []).map((item) => ({ item, plan: item.id === undefined ? undefined : byId.get(item.id) }));
       for (const { item, plan } of proposal) {
         validarFechaVencimientoPlan(item.fechaVencimiento, loan.fechaAlta);
         if (item.id === undefined && item.fechaVencimiento <= originalLastDate) {
           throw new BadRequestException('Las nuevas cuotas deben tener fechas posteriores al plan original.');
         }
       }
       const editableProposal = proposal.filter(({ plan }) => !plan || flagsFor(plan).editable);
       for (const { item } of editableProposal) {
         if (item.montoProgramado === undefined) throw new BadRequestException('Las cuotas editables deben incluir un monto.');
       }
        let nextNumber = Math.max(...plans.map((plan) => plan.numeroPago), 0) + 1;
        const projectedEditable = editableProposal.map(({ item, plan }) => {
          const projected = { ...(plan ?? { id: undefined, prestamoId, fechaCreacion: new Date() }), numeroPago: plan?.numeroPago ?? nextNumber++, fechaVencimiento: item.fechaVencimiento, montoProgramado: money(item.montoProgramado!) } as PlanPagoOrmEntity;
         return projected;
       });
        const dateOnlyProposal = dateOnly ? proposal.find(({ plan }) => plan?.id === dateOnly.id)?.item : undefined;
        const projectedDateOnly = dateOnlyProposal ? { ...dateOnly, fechaVencimiento: dateOnlyProposal.fechaVencimiento } : undefined;
        const finalProjected = [...plans.filter((plan) => protectedIds.has(plan.id) && plan.id !== dateOnly?.id), ...(projectedDateOnly ? [projectedDateOnly] : []), ...projectedEditable].sort((a, b) => a.numeroPago - b.numeroPago || (a.id ?? 0) - (b.id ?? 0));
       let previous: string | Date = dateText(loan.fechaAlta);
       for (const plan of finalProjected) {
         validarFechaVencimientoPlan(dateText(plan.fechaVencimiento), loan.fechaAlta, previous);
         previous = dateText(plan.fechaVencimiento);
       }
        const proposedTotal = projectedEditable.reduce((total, plan) => total + cents(plan.montoProgramado), 0);
       if (proposedTotal !== balance) throw new BadRequestException('La suma de las cuotas futuras editables debe coincidir con el saldo financiero pendiente.');

      const omitted = editable.filter((plan) => !submittedIds.has(plan.id));
       if (omitted.length) await planRepository.remove(omitted);

      const finalEntities: PlanPagoOrmEntity[] = [];
       for (let index = 0; index < proposal.length; index += 1) {
         const { item, plan } = proposal[index];
         if (plan && !flagsFor(plan).editable) {
           plan.fechaVencimiento = item.fechaVencimiento;
           finalEntities.push(plan);
           continue;
         }
         const entity = plan ?? planRepository.create({ prestamoId, numeroPago: 0, fechaVencimiento: item.fechaVencimiento, montoProgramado: money(item.montoProgramado!) });
         entity.prestamoId = prestamoId;
         entity.numeroPago = projectedEditable[editableProposal.findIndex(({ item: candidate }) => candidate === item)].numeroPago;
         entity.fechaVencimiento = item.fechaVencimiento;
         entity.montoProgramado = money(item.montoProgramado!);
         finalEntities.push(entity);
       }
        if (finalEntities.length) await planRepository.save(finalEntities);

       const all = [...plans.filter((plan) => protectedIds.has(plan.id)), ...finalEntities].sort((a, b) => a.numeroPago - b.numeroPago || (a.id ?? 0) - (b.id ?? 0));
       const finalLastProtectedNumber = getLastProtectedNumber(all, protectedIds);
       const finalLastOperationalNumber = getLastOperationalNumber(all, protectedIds);
      return {
        saldoPendiente: balance / 100,
        totalPlanOperativoPendiente: getTotalPlanOperativoPendienteCents(all, registeredByPlan as Map<number, number>) / 100,
        cuotas: all.map((plan) => {
          const paid = registeredByPlan.get(plan.id) ?? 0;
              const flags = this.editability?.calcularFlags(plan.numeroPago, protectedIds, plan.id!, loan.estado, finalLastProtectedNumber, finalLastOperationalNumber) ?? calculatePlanPagoFlags(plan.numeroPago, protectedIds, plan.id!, loan.estado, finalLastProtectedNumber, finalLastOperationalNumber);
             const pending = getPlanPagoPendingCents(plan, registeredByPlan as Map<number, number>);
             return { id: plan.id, numeroPago: plan.numeroPago, fechaVencimiento: dateText(plan.fechaVencimiento), montoProgramado: plan.montoProgramado, montoPagado: paid / 100, montoPendiente: pending / 100, estado: paid > 0 ? 'PAGADA' : 'PENDIENTE', ...flags };
        }),
      };
    });
  }
}
