import { BadRequestException, Inject, Injectable, NotFoundException, Optional, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AnularPrestamoDto } from '../dto/anular-prestamo.dto';
import { PrestamoOrmEntity } from '../../infrastructure/persistence/typeorm/prestamo.orm-entity';
import { PrestamoEstadoHistorialService } from '../services/prestamo-estado-historial.service';
import { PrestamoAnulacionService } from '../services/prestamo-anulacion.service';
import { PRESTAMO_REPOSITORY, PrestamoRepository } from '../../domain/repositories/prestamo.repository';
import { MovimientoCajaService } from '../../../movimientos-caja/application/services/movimiento-caja.service';
import { FinancialPeriodService } from '../../../cierre-financiero/application/financial-period.service';
import { EstadoPrestamo } from '../../domain/enums/estado-prestamo.enum';
import { dateOnly } from '../../../planes-pago/application/services/date-only';

const economicDate = (value: string): Date => new Date(`${dateOnly(value)}T00:00:00.000Z`);

@Injectable()
export class AnularPrestamoUseCase {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly caja: MovimientoCajaService,
    private readonly history: PrestamoEstadoHistorialService,
    private readonly eligibility: PrestamoAnulacionService,
    @Optional() @Inject(PRESTAMO_REPOSITORY) private readonly repository?: PrestamoRepository,
    @Optional() private readonly periods?: FinancialPeriodService,
  ) {}

  async execute(id: number, dto: AnularPrestamoDto, actorUsuarioId?: number) {
    if (!actorUsuarioId) throw new UnauthorizedException('Se requiere una identidad autenticada para anular préstamos.');
    const effectiveDate = economicDate(dto.fecha);
    return this.dataSource.transaction(async (manager) => {
      if (this.periods) await this.periods.assertOpen(manager, effectiveDate);
      const loan = await manager.getRepository(PrestamoOrmEntity).createQueryBuilder('prestamo')
        .where('prestamo.id = :id', { id }).setLock('pessimistic_write').getOne();
      if (!loan) throw new NotFoundException('Préstamo no encontrado.');
      await this.eligibility.assertPuedeAnular(manager, id);
      await this.caja.reversarDesembolsoPrestamoPorAnulacion(manager, id, effectiveDate, dto.observacion?.trim() || 'Anulación de préstamo.', actorUsuarioId);
      const previousState = loan.estado;
      loan.estado = EstadoPrestamo.ANULADO;
      await manager.getRepository(PrestamoOrmEntity).save(loan);
      await this.history.registrar(manager, id, previousState, loan.estado, effectiveDate, actorUsuarioId, dto.observacion);
      return id;
    }).then(async (loanId) => {
      if (this.repository) {
        const result = await this.repository.buscarPorId(loanId);
        if (!result) throw new NotFoundException('Préstamo no encontrado.');
        return result;
      }
      const result = await this.dataSource.getRepository(PrestamoOrmEntity).findOne({ where: { id: loanId } });
      if (!result) throw new NotFoundException('Préstamo no encontrado.');
      return result;
    });
  }
}
