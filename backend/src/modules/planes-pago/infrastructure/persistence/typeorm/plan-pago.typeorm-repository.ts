import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PlanPago } from '../../../domain/entities/plan-pago';
import { PlanPagoRepository } from '../../../domain/repositories/plan-pago.repository';
import { PlanPagoMapper } from './plan-pago.mapper';
import { PlanPagoOrmEntity } from './plan-pago.orm-entity';
import { PrestamoOrmEntity } from '../../../../prestamos/infrastructure/persistence/typeorm/prestamo.orm-entity';

@Injectable()
export class PlanPagoTypeOrmRepository implements PlanPagoRepository {
  constructor(@InjectRepository(PlanPagoOrmEntity) private readonly repository: Repository<PlanPagoOrmEntity>, @InjectDataSource() private readonly dataSource: DataSource) {}

  async guardarMuchos(planes: PlanPago[], prestamoId: number, planPersonalizado: boolean): Promise<PlanPago[]> {
    return this.dataSource.transaction((manager) => this.guardarMuchosEnTransaccion(manager, planes, prestamoId, planPersonalizado));
  }

  async guardarMuchosEnTransaccion(manager: DataSource['manager'], planes: PlanPago[], prestamoId: number, planPersonalizado: boolean): Promise<PlanPago[]> {
    if ((await manager.getRepository(PlanPagoOrmEntity).count({ where: { prestamoId } })) > 0) throw new ConflictException('El préstamo ya tiene un plan de pago.');
    const saved = await manager.getRepository(PlanPagoOrmEntity).save(planes.map(PlanPagoMapper.toOrm));
    await manager.getRepository(PrestamoOrmEntity).update(prestamoId, { planPersonalizado });
    return saved.sort((a, b) => a.numeroPago - b.numeroPago).map(PlanPagoMapper.toDomain);
  }

  async buscarPorPrestamoId(prestamoId: number): Promise<PlanPago[]> {
    const entities = await this.repository.find({ where: { prestamoId }, order: { numeroPago: 'ASC' } });
    return entities.map(PlanPagoMapper.toDomain);
  }

  async buscarPorId(id: number): Promise<PlanPago | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? PlanPagoMapper.toDomain(entity) : null;
  }

  async existePlanParaPrestamo(prestamoId: number): Promise<boolean> { return (await this.repository.count({ where: { prestamoId } })) > 0; }

  async reemplazarPlan(planes: PlanPago[], prestamoId: number): Promise<PlanPago[]> {
    return this.dataSource.transaction(async (manager) => {
      const plans = manager.getRepository(PlanPagoOrmEntity);
      await plans.delete({ prestamoId });
      const saved = await plans.save(planes.map(PlanPagoMapper.toOrm));
      await manager.getRepository(PrestamoOrmEntity).update(prestamoId, { planPersonalizado: true });
      return saved.sort((a, b) => a.numeroPago - b.numeroPago).map(PlanPagoMapper.toDomain);
    });
  }
}
