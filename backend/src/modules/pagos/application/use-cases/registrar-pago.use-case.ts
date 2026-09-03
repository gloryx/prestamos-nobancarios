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
      const cobrador = await this.usuarios.buscarPorIdEnTransaccion(manager, dto.cobradorId);
       if (!cobrador) throw new NotFoundException('Cobrador no encontrado.');
       if (!cobrador.activo) throw new BadRequestException('El cobrador seleccionado está inactivo.');
      const prestamo = await manager.getRepository(PrestamoOrmEntity).createQueryBuilder('prestamo').where('prestamo.id = :id', { id: dto.prestamoId }).setLock('pessimistic_write').getOne();
      if (!prestamo) throw new NotFoundException('Préstamo no encontrado.');
      if (prestamo.estado !== EstadoPrestamo.ACTIVO) throw new BadRequestException('Solo se pueden registrar pagos de préstamos activos.');
      const totals = await manager.getRepository(PagoOrmEntity).createQueryBuilder('pago').select('COALESCE(SUM(pago.monto), 0)', 'total').addSelect('COALESCE(SUM(pago.capital_aplicado), 0)', 'capital').addSelect('COALESCE(SUM(pago.interes_aplicado), 0)', 'interes').where('pago.prestamo_id = :id', { id: dto.prestamoId }).getRawOne<{ total: string; capital: string; interes: string }>();
      const capitalPendiente = Math.max(0, prestamo.capital - Number(totals?.capital ?? 0));
      const interesPendiente = Math.max(0, prestamo.interes - Number(totals?.interes ?? 0));
      let distribucion;
      try { distribucion = DistribuidorPagoService.distribuir(dto.monto, capitalPendiente, interesPendiente); } catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'El pago no es válido.'); }
        const pago = Pago.crear({ prestamoId: dto.prestamoId, formaPagoId: dto.formaPagoId, monto: dto.monto, capitalAplicado: distribucion.capital, interesAplicado: distribucion.interes, cobradorId: dto.cobradorId, fecha, observaciones: dto.observaciones });
       const saved = await manager.getRepository(PagoOrmEntity).save(PagoMapper.toOrm(pago));
         if (cents(Number(totals?.capital ?? 0)) + cents(distribucion.capital) >= cents(prestamo.capital) && cents(Number(totals?.interes ?? 0)) + cents(distribucion.interes) >= cents(prestamo.interes)) { const previousState = prestamo.estado; prestamo.estado = EstadoPrestamo.CANCELADO; await manager.getRepository(PrestamoOrmEntity).save(prestamo); if (this.history) await this.history.registrar(manager, prestamo.id, previousState, EstadoPrestamo.CANCELADO, fecha, actorUsuarioId, dto.observaciones); }
        if (this.caja && actorUsuarioId) await this.caja.automatico(manager, { tipo: TipoMovimientoCaja.ENTRADA, concepto: ConceptoMovimientoCaja.PAGO_CLIENTE, monto: dto.monto, fecha, observaciones: dto.observaciones?.trim() || null, pagoId: saved.id, prestamoId: dto.prestamoId, refinanciamientoId: null, movimientoReversadoId: null, usuarioId: actorUsuarioId });
        const complete = await manager.getRepository(PagoOrmEntity).createQueryBuilder('pago').leftJoinAndSelect('pago.formaPago', 'formaPago').leftJoinAndSelect('pago.cobrador', 'cobrador').leftJoinAndSelect('pago.prestamo', 'prestamo').leftJoinAndSelect('prestamo.cliente', 'cliente').where('pago.id = :id', { id: saved.id }).getOne();
       return PagoMapper.toDomain(complete ?? saved);
    });
  }
}
