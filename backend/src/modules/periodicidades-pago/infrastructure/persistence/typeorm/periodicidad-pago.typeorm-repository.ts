import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, ILike, Repository } from 'typeorm';
import { PeriodicidadPago } from '../../../domain/entities/periodicidad-pago';
import { FiltrosPeriodicidadesPagoAdministracion, PeriodicidadPagoRepository } from '../../../domain/repositories/periodicidad-pago.repository';
import { PeriodicidadPagoMapper } from './periodicidad-pago.mapper';
import { PeriodicidadPagoOrmEntity } from './periodicidad-pago.orm-entity';

@Injectable()
export class PeriodicidadPagoTypeOrmRepository implements PeriodicidadPagoRepository {
  constructor(
    @InjectRepository(PeriodicidadPagoOrmEntity)
    private readonly repository: Repository<PeriodicidadPagoOrmEntity>,
  ) {}

  async guardar(periodicidadPago: PeriodicidadPago): Promise<PeriodicidadPago> {
    const entity = await this.repository.save(PeriodicidadPagoMapper.toOrm(periodicidadPago));
    return PeriodicidadPagoMapper.toDomain(entity);
  }

  async buscarPorId(id: number): Promise<PeriodicidadPago | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? PeriodicidadPagoMapper.toDomain(entity) : null;
  }
  async buscarPorIdEnTransaccion(manager: EntityManager, id: number): Promise<PeriodicidadPago | null> { const entity = await manager.getRepository(PeriodicidadPagoOrmEntity).findOne({ where: { id } }); return entity ? PeriodicidadPagoMapper.toDomain(entity) : null; }

  async buscarPorNombre(nombre: string): Promise<PeriodicidadPago | null> {
    const entity = await this.repository.findOne({ where: { nombre: ILike(nombre.trim()) } });
    return entity ? PeriodicidadPagoMapper.toDomain(entity) : null;
  }

  async listar(): Promise<PeriodicidadPago[]> {
    const entities = await this.repository.find({ order: { nombre: 'ASC' } });
    return entities.map((entity) => PeriodicidadPagoMapper.toDomain(entity));
  }

  async listarAdministracion(filtros: FiltrosPeriodicidadesPagoAdministracion) {
    const query = this.repository.createQueryBuilder('periodicidad');
    query.orderBy('periodicidad.nombre', 'ASC').addOrderBy('periodicidad.id', 'ASC');
    query.skip((filtros.pagina - 1) * filtros.limite).take(filtros.limite);
    const [entities, total] = await query.getManyAndCount();
    return { datos: entities.map((entity) => PeriodicidadPagoMapper.toDomain(entity)), pagina: filtros.pagina, limite: filtros.limite, total, totalPaginas: Math.ceil(total / filtros.limite) };
  }

  async actualizar(periodicidadPago: PeriodicidadPago): Promise<PeriodicidadPago> {
    const entity = await this.repository.save(PeriodicidadPagoMapper.toOrm(periodicidadPago));
    return PeriodicidadPagoMapper.toDomain(entity);
  }
}
