import { BadRequestException, Inject, Injectable, NotFoundException, Optional, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FORMA_PAGO_REPOSITORY, FormaPagoRepository } from '../../../formas-pago/domain/repositories/forma-pago.repository';
import { USUARIO_REPOSITORY, UsuarioRepository } from '../../../usuarios/domain/repositories/usuario.repository';
import { PrestamoOrmEntity } from '../../../prestamos/infrastructure/persistence/typeorm/prestamo.orm-entity';
import { EstadoPrestamo } from '../../../prestamos/domain/enums/estado-prestamo.enum';
import { CrearPagoDto } from '../dto/crear-pago.dto';
import { Pago } from '../../domain/entities/pago';
import { PagoConRelaciones } from '../../domain/repositories/pago.repository';
import { PagoOrmEntity } from '../../infrastructure/persistence/typeorm/pago.orm-entity';
import { PagoMapper } from '../../infrastructure/persistence/typeorm/pago.mapper';
import { PlanPagoOrmEntity } from '../../../planes-pago/infrastructure/persistence/typeorm/plan-pago.orm-entity';
import { DistribuidorPagoService } from '../../domain/services/distribuidor-pago.service';
import { MovimientoCajaService } from '../../../movimientos-caja/application/services/movimiento-caja.service';
import { ConceptoMovimientoCaja } from '../../../movimientos-caja/domain/enums/concepto-movimiento-caja.enum';
import { TipoMovimientoCaja } from '../../../movimientos-caja/domain/enums/tipo-movimiento-caja.enum';
import { FinancialPeriodService } from '../../../cierre-financiero/application/financial-period.service';
import { PrestamoEstadoHistorialService } from '../../../prestamos/application/services/prestamo-estado-historial.service';

const dateFromDto = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
const cents = (value: number) => Math.round(value * 100);

@Injectable()
export class RegistrarPagoUseCase {
  constructor(@InjectDataSource() private readonly dataSource: DataSource, @Inject(FORMA_PAGO_REPOSITORY) private readonly formas: FormaPagoRepository, @Inject(USUARIO_REPOSITORY) private readonly usuarios: UsuarioRepository, private readonly caja: MovimientoCajaService, @Optional() private readonly history?: PrestamoEstadoHistorialService, @Optional() private readonly periods?: FinancialPeriodService) {}
  async execute(dto: CrearPagoDto, actorUsuarioId?: number): Promise<PagoConRelaciones> {
    if (!actorUsuarioId) throw new UnauthorizedException('Se requiere una identidad autenticada para registrar pagos.');
    const fecha = dateFromDto(dto.fecha);
    return this.dataSource.transaction(async (manager) => {
      if (this.periods) await this.periods.assertOpen(manager, fecha);
      const forma = await this.formas.buscarPorIdEnTransaccion(manager, dto.formaPagoId);
      if (!forma) throw new NotFoundException('Forma de pago no encontrada.');
      if (!forma.activo) throw new BadRequestException('La forma de pago seleccionada está inactiva.');
       if (dto.cobradorId == null) throw new BadRequestException('El cobrador es obligatorio.');
       const cobrador = await this.usuarios.buscarPorIdEnTransaccion(manager, dto.cobradorId);
       if (!cobrador) throw new NotFoundException('Cobrador no encontrado.');
       if (!cobrador.activo) throw new BadRequestException('El cobrador seleccionado está inactivo.');
      const prestamo = await manager.getRepository(PrestamoOrmEntity).createQueryBuilder('prestamo').where('prestamo.id = :id', { id: dto.prestamoId }).setLock('pessimistic_write').getOne();
      if (!prestamo) throw new NotFoundException('Préstamo no encontrado.');
      if (prestamo.estado !== EstadoPrestamo.ACTIVO) throw new BadRequestException('Solo se pueden registrar pagos de préstamos activos.');
       if (!dto.planPagoId) throw new BadRequestException('Debe seleccionar una cuota para registrar el pago.');
        if (!Number.isFinite(dto.monto) || dto.monto <= 0 || !Number.isInteger(dto.monto * 100)) throw new BadRequestException('El monto debe ser mayor que cero y tener como máximo dos decimales.');
        const planRepository = manager.getRepository(PlanPagoOrmEntity);
         const lockedPlans = await planRepository.createQueryBuilder('plan')
           .where('plan.prestamo_id = :prestamoId', { prestamoId: dto.prestamoId })
           .orderBy('plan.numero_pago', 'ASC')
           .setLock('pessimistic_write')
           .getMany();
        const planTotalCents = lockedPlans.reduce((sum, plan) => sum + cents(plan.montoProgramado), 0);
        if (planTotalCents !== cents(prestamo.montoTotal)) throw new BadRequestException('El total del plan de pago no coincide con el monto total del préstamo.');
         const payments = await manager.getRepository(PagoOrmEntity).createQueryBuilder('pago')
           .where('pago.prestamo_id = :prestamoId', { prestamoId: dto.prestamoId }).getMany();
         const paidByPlan = new Map<number, number>();
         for (const payment of payments) if (payment.planPagoId != null) paidByPlan.set(payment.planPagoId, (paidByPlan.get(payment.planPagoId) ?? 0) + cents(payment.monto));
         const hasPaymentsByPlan = new Set<number>(payments.flatMap((payment) => payment.planPagoId == null ? [] : [payment.planPagoId]));
         const firstPending = lockedPlans.find((plan) => (paidByPlan.get(plan.id) ?? 0) < cents(plan.montoProgramado));
         const planPago = lockedPlans.find((plan) => plan.id === dto.planPagoId);
         if (!planPago) throw new BadRequestException('La cuota seleccionada no pertenece al préstamo.');
          if (firstPending && planPago.id !== firstPending.id) throw new BadRequestException('Debe registrar el pago sobre la primera cuota pendiente del plan.');
         const previousPaidCents = paidByPlan.get(planPago.id) ?? 0;
        const oldCurrentCents = cents(planPago.montoProgramado);
        if (previousPaidCents >= oldCurrentCents) throw new BadRequestException('La cuota seleccionada ya está PAGADA y no admite nuevos pagos.');
       const totals = await manager.getRepository(PagoOrmEntity).createQueryBuilder('pago').select('COALESCE(SUM(pago.monto), 0)', 'total').addSelect('COALESCE(SUM(pago.capital_aplicado), 0)', 'capital').addSelect('COALESCE(SUM(pago.interes_aplicado), 0)', 'interes').where('pago.prestamo_id = :id', { id: dto.prestamoId }).getRawOne<{ total: string; capital: string; interes: string }>();
       const capitalPendiente = Math.max(0, prestamo.capital - Number(totals?.capital ?? 0));
       const interesPendiente = Math.max(0, prestamo.interes - Number(totals?.interes ?? 0));
       let distribucion;
       try { distribucion = DistribuidorPagoService.distribuir(dto.monto, capitalPendiente, interesPendiente); } catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'El pago no es válido.'); }
       const paymentCents = cents(dto.monto);
       const newPaidTotalCents = previousPaidCents + paymentCents;
        // A partial payment must not rewrite the contractual amount of the current
        // installment. Only the amount above that installment may be redistributed.
        const overpaymentCents = newPaidTotalCents - oldCurrentCents;
       const futurePlans = lockedPlans
         .filter((plan) => plan.numeroPago > planPago.numeroPago && !hasPaymentsByPlan.has(plan.id))
         .sort((a, b) => a.numeroPago - b.numeroPago);
        const hasFutureEligible = futurePlans.length > 0;
        const plansToDelete: PlanPagoOrmEntity[] = [];
        const affectedFuturePlans = new Set<PlanPagoOrmEntity>();
        if (hasFutureEligible && overpaymentCents > 0) {
          // Preserve the existing overpayment behavior only after the installment
          // is complete: the extra paid amount becomes part of its operational
          // amount while the same amount is removed from future installments.
          planPago.montoProgramado = newPaidTotalCents / 100;
            let remaining = overpaymentCents;
            for (const future of futurePlans) {
             if (remaining === 0) break;
             const futureCents = cents(future.montoProgramado);
              if (remaining >= futureCents) {
                remaining -= futureCents;
                future.montoProgramado = 0;
                plansToDelete.push(future);
                affectedFuturePlans.add(future);
              } else {
                future.montoProgramado = (futureCents - remaining) / 100;
                remaining = 0;
                affectedFuturePlans.add(future);
             }
           }
            if (remaining !== 0) throw new BadRequestException('No hay suficiente saldo pendiente en cuotas futuras para redistribuir el sobrepago.');
        }
       const resultingPlanCents = lockedPlans
         .filter((plan) => !plansToDelete.includes(plan))
         .reduce((sum, plan) => sum + cents(plan.montoProgramado), 0);
       if (resultingPlanCents !== planTotalCents) throw new BadRequestException('El total del plan de pago no coincide con el monto total del préstamo.');

       const futureWithPayments = lockedPlans.some((plan) => plan.numeroPago > planPago.numeroPago && hasPaymentsByPlan.has(plan.id));
       const canRenumber = !futureWithPayments;
       const survivingFuturePlans = futurePlans.filter((plan) => !plansToDelete.includes(plan));
        // PostgreSQL date columns are represented as calendar strings here. Keep
        // the selected payment date unchanged; do not derive it from a Date.
        planPago.fechaVencimiento = dto.fecha;
        for (const future of affectedFuturePlans) future.fechaVencimiento = dto.fecha;
       if (canRenumber) {
         const temporaryBase = lockedPlans.reduce((maximum, plan) => Math.max(maximum, plan.numeroPago), 0) + 1_000_000;
         for (let index = 0; index < survivingFuturePlans.length; index += 1) {
           survivingFuturePlans[index].numeroPago = temporaryBase + index;
           await planRepository.save(survivingFuturePlans[index]);
         }
       }
       await planRepository.save(planPago);
       for (const future of futurePlans) if (!plansToDelete.includes(future)) await planRepository.save(future);
       if (plansToDelete.length) await planRepository.remove(plansToDelete);
        if (canRenumber) {
          for (let index = 0; index < survivingFuturePlans.length; index += 1) {
            survivingFuturePlans[index].numeroPago = planPago.numeroPago + index + 1;
            await planRepository.save(survivingFuturePlans[index]);
          }
        }
        const pago = Pago.crear({ prestamoId: dto.prestamoId, formaPagoId: dto.formaPagoId, monto: dto.monto, capitalAplicado: distribucion.capital, interesAplicado: distribucion.interes, cobradorId: dto.cobradorId, fecha, observaciones: dto.observaciones, planPagoId: planPago.id });
        const saved = await manager.getRepository(PagoOrmEntity).save(PagoMapper.toOrm(pago));
         if (cents(Number(totals?.capital ?? 0)) + cents(distribucion.capital) >= cents(prestamo.capital) && cents(Number(totals?.interes ?? 0)) + cents(distribucion.interes) >= cents(prestamo.interes)) { const previousState = prestamo.estado; prestamo.estado = EstadoPrestamo.CANCELADO; await manager.getRepository(PrestamoOrmEntity).save(prestamo); if (this.history) await this.history.registrar(manager, prestamo.id, previousState, EstadoPrestamo.CANCELADO, fecha, actorUsuarioId, dto.observaciones); }
         if (this.caja && actorUsuarioId) await this.caja.automatico(manager, { tipo: TipoMovimientoCaja.ENTRADA, concepto: ConceptoMovimientoCaja.PAGO_CLIENTE, monto: dto.monto, fecha, observaciones: dto.observaciones?.trim() || null, pagoId: saved.id, formaPagoId: dto.formaPagoId, prestamoId: dto.prestamoId, refinanciamientoId: null, movimientoReversadoId: null, usuarioId: actorUsuarioId });
         const complete = await manager.getRepository(PagoOrmEntity).createQueryBuilder('pago').leftJoinAndSelect('pago.formaPago', 'formaPago').leftJoinAndSelect('pago.cobrador', 'cobrador').leftJoinAndSelect('pago.prestamo', 'prestamo').leftJoinAndSelect('prestamo.cliente', 'cliente').leftJoinAndSelect('pago.planPago', 'planPago').where('pago.id = :id', { id: saved.id }).getOne();
       return PagoMapper.toDomain(complete ?? saved);
    });
  }
}
