import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EstadoPrestamo } from '../../domain/enums/estado-prestamo.enum';
import { PRESTAMO_REPOSITORY, PrestamoConRelaciones, PrestamoRepository } from '../../domain/repositories/prestamo.repository';
import { CambiarEstadoPrestamoDto } from '../dto/cambiar-estado-prestamo.dto';
import { PrestamoOrmEntity } from '../../infrastructure/persistence/typeorm/prestamo.orm-entity';
import { PrestamoEstadoHistorialService } from '../services/prestamo-estado-historial.service';
import { FinancialPeriodService } from '../../../cierre-financiero/application/financial-period.service';
@Injectable()
export class CambiarEstadoPrestamoUseCase {
  constructor(@Inject(PRESTAMO_REPOSITORY) private readonly repository: PrestamoRepository, @InjectDataSource() private readonly dataSource: DataSource, private readonly history: PrestamoEstadoHistorialService, @Optional() private readonly periods?: FinancialPeriodService) {}
  async execute(id: number, dto: CambiarEstadoPrestamoDto, actorUsuarioId?: number): Promise<PrestamoConRelaciones> {
    if (!actorUsuarioId) throw new BadRequestException('Se requiere una identidad autenticada para cambiar estados.');
    const effectiveDate = dto.fecha ? new Date(`${dto.fecha.slice(0, 10)}T00:00:00.000Z`) : new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
    const resultId = await this.dataSource.transaction(async manager => {
    if (this.periods) await this.periods.assertOpen(manager, effectiveDate);
    const prestamo = await manager.getRepository(PrestamoOrmEntity).createQueryBuilder('p').where('p.id = :id', { id }).setLock('pessimistic_write').getOne();
    if (!prestamo) throw new NotFoundException('Préstamo no encontrado.');
    const previousState = prestamo.estado;
    if (effectiveDate.toISOString().slice(0, 10) < prestamo.fechaAlta) throw new BadRequestException('La fecha efectiva no puede ser anterior al alta del préstamo.');
    if (dto.estado === EstadoPrestamo.CANCELADO) throw new BadRequestException('El estado CANCELADO se asigna automáticamente al completar el pago del préstamo.');
    if (dto.estado === EstadoPrestamo.REFINANCIADO) throw new BadRequestException('El estado REFINANCIADO se asigna desde el proceso de refinanciamiento.');
    if (prestamo.estado === EstadoPrestamo.ACTIVO && dto.estado === EstadoPrestamo.INCOBRABLE) prestamo.estado = EstadoPrestamo.INCOBRABLE;
    else if (prestamo.estado === EstadoPrestamo.INCOBRABLE && dto.estado === EstadoPrestamo.ACTIVO) prestamo.estado = EstadoPrestamo.ACTIVO;
    else throw new BadRequestException(`No se permite cambiar el estado ${prestamo.estado} a ${dto.estado}.`);
    await manager.getRepository(PrestamoOrmEntity).save(prestamo);
    await this.history.registrar(manager, id, previousState, dto.estado, effectiveDate, actorUsuarioId, dto.observacion);
    return id;
    });
    const updated = await this.repository.buscarPorId(resultId); if (!updated) throw new Error('No se pudo recuperar el préstamo actualizado.'); return updated;
  }
}
