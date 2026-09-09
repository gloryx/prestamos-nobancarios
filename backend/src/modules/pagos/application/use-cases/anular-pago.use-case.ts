import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { MovimientoCajaService } from '../../../movimientos-caja/application/services/movimiento-caja.service';
import { PrestamoEstadoHistorialService } from '../../../prestamos/application/services/prestamo-estado-historial.service';
import { EstadoPrestamo } from '../../../prestamos/domain/enums/estado-prestamo.enum';
import { PrestamoOrmEntity } from '../../../prestamos/infrastructure/persistence/typeorm/prestamo.orm-entity';
import { RefinanciamientoOrmEntity } from '../../../refinanciamientos/infrastructure/persistence/typeorm/refinanciamiento.orm-entity';
import { AnularPagoDto } from '../dto/anular-pago.dto';
import { EstadoPago } from '../../domain/enums/estado-pago.enum';
import { PagoOrmEntity } from '../../infrastructure/persistence/typeorm/pago.orm-entity';
import { PagoAnulacion } from '../../domain/entities/pago-anulacion';
import { PAGO_ANULACION_REPOSITORY, PagoAnulacionRepository } from '../../domain/repositories/pago-anulacion.repository';

const dateOnly = (date: Date) => date.toISOString().slice(0, 10);

@Injectable()
export class AnularPagoUseCase {
  constructor(@InjectDataSource() private readonly db: DataSource, private readonly caja: MovimientoCajaService, private readonly history: PrestamoEstadoHistorialService, @Inject(PAGO_ANULACION_REPOSITORY) private readonly anulaciones: PagoAnulacionRepository) {}

  async execute(id: number, dto: AnularPagoDto, actorUsuarioId?: number) {
    if (!actorUsuarioId) throw new UnauthorizedException('Se requiere una identidad autenticada para anular pagos.');
    return this.db.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(PagoOrmEntity);
      const paymentReference = await paymentRepo.createQueryBuilder('pago').where('pago.id = :id', { id }).getOne();
      if (!paymentReference) throw new NotFoundException('Pago no encontrado.');
      const loan = await manager.getRepository(PrestamoOrmEntity).createQueryBuilder('prestamo').where('prestamo.id = :id', { id: paymentReference.prestamoId }).setLock('pessimistic_write').getOne();
      if (!loan) throw new NotFoundException('Préstamo no encontrado.');
      const payment = await paymentRepo.createQueryBuilder('pago').where('pago.id = :id', { id }).setLock('pessimistic_write').getOne();
      if (!payment) throw new NotFoundException('Pago no encontrado.');
      if (payment.estado === EstadoPago.ANULADO) throw new ConflictException('El pago ya fue anulado.');
      const later = await paymentRepo.createQueryBuilder('pago').where('pago.prestamo_id = :loanId', { loanId: loan.id }).andWhere('pago.estado = :state', { state: EstadoPago.REGISTRADO }).andWhere('(pago.fecha > :fecha OR (pago.fecha = :fecha AND pago.id > :id))', { fecha: payment.fecha, id: payment.id }).getOne();
      if (later) throw new BadRequestException('Existen pagos posteriores. Debe anular primero el pago más reciente.');
      const refinancing = await manager.getRepository(RefinanciamientoOrmEntity).createQueryBuilder('ref').where('ref.prestamo_origen_id = :loanId', { loanId: loan.id }).setLock('pessimistic_write').getOne();
      if (refinancing) throw new BadRequestException('No se puede anular un pago de un préstamo con refinanciamiento posterior.');
      if (payment.redistribuyoPlan === true) throw new BadRequestException('Este pago redistribuyó el plan de pago y no puede anularse automáticamente.');
      if (payment.redistribuyoPlan === null) throw new BadRequestException('No existe información histórica suficiente para anular este pago automáticamente.');
      if (payment.redistribuyoPlan !== false) throw new BadRequestException('No existe información histórica suficiente para anular este pago automáticamente.');
      const fechaAnulacion = new Date();
      const observacionAnulacion = dto.observacion?.trim() || null;
      const original = await this.caja.reversarPagoCliente(manager, payment.id, fechaAnulacion, observacionAnulacion || dto.motivo, actorUsuarioId);
      payment.estado = EstadoPago.ANULADO;
      await paymentRepo.save(payment);
      const audit = await this.anulaciones.guardarEnTransaccion(manager, new PagoAnulacion(null, payment.id, fechaAnulacion, actorUsuarioId, dto.motivo, observacionAnulacion, new Date()));
      const totals = await paymentRepo.createQueryBuilder('pago').select('COALESCE(SUM(pago.monto), 0)', 'total').addSelect('COALESCE(SUM(pago.capital_aplicado), 0)', 'capital').addSelect('COALESCE(SUM(pago.interes_aplicado), 0)', 'interes').where('pago.prestamo_id = :loanId', { loanId: loan.id }).andWhere('pago.estado = :state', { state: EstadoPago.REGISTRADO }).getRawOne<{ total: string; capital: string; interes: string }>();
      const totalPagado = Number(totals?.total ?? 0); const capitalPagado = Number(totals?.capital ?? 0); const interesPagado = Number(totals?.interes ?? 0); const saldoPendiente = Math.max(loan.montoTotal - totalPagado, 0); const capitalPendiente = Math.max(loan.capital - capitalPagado, 0);
      const previousState = loan.estado;
      if (saldoPendiente > 0 && loan.estado === EstadoPrestamo.CANCELADO) { loan.estado = EstadoPrestamo.ACTIVO; await manager.getRepository(PrestamoOrmEntity).save(loan); await this.history.registrar(manager, loan.id, previousState, loan.estado, new Date(), actorUsuarioId, audit.observacion); }
      return { pagoId: payment.id, status: payment.estado, fechaAnulacion: audit.fecha, usuarioAnulacionId: audit.usuarioId, motivoAnulacion: audit.motivo, observacionAnulacion: audit.observacion, prestamoId: loan.id, prestamoEstado: loan.estado, totalPagado, saldoPendiente, capitalPendiente, interesPendiente: Math.max(loan.interes - interesPagado, 0), reversalCajaId: original.id, reversalOfCajaId: original.movimientoReversadoId, reversalMonto: original.monto, fechaAnulacionCalendario: dateOnly(audit.fecha) };
    });
  }
}
