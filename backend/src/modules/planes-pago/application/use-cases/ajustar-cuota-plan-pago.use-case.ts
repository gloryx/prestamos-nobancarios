import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { EstadoPrestamo } from '../../../prestamos/domain/enums/estado-prestamo.enum';
import { PagoOrmEntity } from '../../../pagos/infrastructure/persistence/typeorm/pago.orm-entity';
import { PrestamoOrmEntity } from '../../../prestamos/infrastructure/persistence/typeorm/prestamo.orm-entity';
import { PlanPagoMapper } from '../../infrastructure/persistence/typeorm/plan-pago.mapper';
import { PlanPagoOrmEntity } from '../../infrastructure/persistence/typeorm/plan-pago.orm-entity';
import { AjustarCuotaPlanPagoDto } from '../dto/ajustar-cuota-plan-pago.dto';
import { validarFechaVencimientoPlan } from './validar-plan-pago';

const cents = (value: number) => Math.round(value * 100);
const money = (value: number) => cents(value) / 100;

@Injectable()
export class AjustarCuotaPlanPagoUseCase {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async execute(planPagoId: number, dto: AjustarCuotaPlanPagoDto) {
    const hasAmount = dto.montoProgramado !== undefined;
    const hasDate = dto.fechaVencimiento !== undefined;
    if (!hasAmount && !hasDate) throw new BadRequestException('Debe indicar un monto o una fecha de vencimiento.');
    if (hasAmount && (!Number.isFinite(dto.montoProgramado) || dto.montoProgramado <= 0 || cents(dto.montoProgramado) !== dto.montoProgramado * 100)) {
      throw new BadRequestException('montoProgramado debe ser positivo y tener como máximo dos decimales.');
    }

    return this.dataSource.transaction(async (manager) => {
      const plans = manager.getRepository(PlanPagoOrmEntity);
      const loans = manager.getRepository(PrestamoOrmEntity);
      const payments = manager.getRepository(PagoOrmEntity);
      const current = await plans.findOne({ where: { id: planPagoId } });
      if (!current) throw new NotFoundException('Cuota del plan de pago no encontrada.');
      const loan = await loans.findOne({ where: { id: current.prestamoId } });
      if (!loan) throw new NotFoundException('Préstamo no encontrado.');
      if (loan.estado !== EstadoPrestamo.ACTIVO) throw new BadRequestException('Solo se puede ajustar una cuota de un préstamo activo.');

      const allPlans = await plans.find({ where: { prestamoId: loan.id }, order: { numeroPago: 'ASC' } });
      if (allPlans.reduce((sum, plan) => sum + cents(plan.montoProgramado), 0) !== cents(loan.montoTotal)) {
        throw new BadRequestException('El total del plan de pago no coincide con el monto total del préstamo.');
      }

      const currentPayments = await payments.find({ where: { planPagoId: current.id } });
      if (currentPayments.length) throw new BadRequestException(currentPayments.reduce((sum, payment) => sum + cents(payment.monto), 0) >= cents(current.montoProgramado) ? 'La cuota ya está PAGADA y no puede ajustarse.' : 'La cuota es PARCIAL y no puede ajustarse.');

      const candidates = allPlans.filter((plan) => plan.numeroPago > current.numeroPago);
      if (!candidates.length) throw new BadRequestException('No existe una cuota posterior pendiente para redistribuir la diferencia.');
      const candidatePayments = await payments.find({ where: { planPagoId: In(candidates.map((plan) => plan.id)) } });
      const plansWithPayments = new Set(candidatePayments.map((payment) => payment.planPagoId));
      const next = candidates.find((plan) => !plansWithPayments.has(plan.id));
      if (!next) throw new BadRequestException('No existe una cuota posterior pendiente para redistribuir la diferencia.');

      const currentIndex = allPlans.findIndex((plan) => plan.id === current.id);
      if (hasDate) validarFechaVencimientoPlan(dto.fechaVencimiento!, loan.fechaAlta, allPlans[currentIndex - 1]?.fechaVencimiento, allPlans[currentIndex + 1]?.fechaVencimiento);

      const locked = await Promise.all([current, next].sort((a, b) => a.id - b.id).map((plan) => plans.findOne({ where: { id: plan.id }, lock: { mode: 'pessimistic_write' } })));
      const lockedCurrent = locked.find((plan) => plan?.id === current.id);
      const lockedNext = locked.find((plan) => plan?.id === next.id);
      if (!lockedCurrent || !lockedNext || lockedCurrent.prestamoId !== lockedNext.prestamoId || lockedCurrent.prestamoId !== loan.id) throw new BadRequestException('Las cuotas no pertenecen al mismo préstamo.');

      const lockedPayments = await payments.find({ where: { planPagoId: In([lockedCurrent.id, lockedNext.id]) } });
      if (lockedPayments.some((payment) => payment.planPagoId === lockedCurrent.id)) throw new BadRequestException('La cuota es PARCIAL y no puede ajustarse.');
      if (lockedPayments.some((payment) => payment.planPagoId === lockedNext.id)) throw new BadRequestException('No existe una cuota posterior pendiente para redistribuir la diferencia.');

      const lockedPlans = await plans.find({ where: { prestamoId: loan.id } });
      if (lockedPlans.reduce((sum, plan) => sum + cents(plan.montoProgramado), 0) !== cents(loan.montoTotal)) throw new BadRequestException('El total del plan de pago no coincide con el monto total del préstamo.');
      const amountChanged = hasAmount && cents(lockedCurrent.montoProgramado) !== cents(dto.montoProgramado!);
      if (hasDate) lockedCurrent.fechaVencimiento = dto.fechaVencimiento!;
      if (amountChanged) {
        const differenceCents = cents(lockedCurrent.montoProgramado) - cents(dto.montoProgramado!);
        const newNextCents = cents(lockedNext.montoProgramado) + differenceCents;
        if (newNextCents <= 0) throw new BadRequestException('El monto de la cuota posterior debe ser mayor que cero.');
        const adjustedTotalCents = lockedPlans.reduce((sum, plan) => {
          if (plan.id === lockedCurrent.id) return sum + cents(dto.montoProgramado!);
          if (plan.id === lockedNext.id) return sum + newNextCents;
          return sum + cents(plan.montoProgramado);
        }, 0);
        if (adjustedTotalCents !== cents(loan.montoTotal)) throw new BadRequestException('El total del plan de pago no coincide con el monto total del préstamo.');
        lockedCurrent.montoProgramado = money(dto.montoProgramado!);
        lockedNext.montoProgramado = money(newNextCents / 100);
        await plans.save(lockedCurrent);
        await plans.save(lockedNext);
      } else if (hasDate) {
        await plans.save(lockedCurrent);
      }
      return { actualizada: PlanPagoMapper.toDomain(lockedCurrent), siguiente: PlanPagoMapper.toDomain(lockedNext) };
    });
  }
}
