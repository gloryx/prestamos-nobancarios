import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Prestamo } from '../../../domain/entities/prestamo';
import { FiltrosPrestamos, PrestamoConRelaciones, PrestamoRepository, PrestamosPaginados } from '../../../domain/repositories/prestamo.repository';
import { PrestamoMapper } from './prestamo.mapper';
import { PrestamoOrmEntity } from './prestamo.orm-entity';

@Injectable()
export class PrestamoTypeOrmRepository implements PrestamoRepository {
  constructor(@InjectRepository(PrestamoOrmEntity) private readonly repository: Repository<PrestamoOrmEntity>) {}
  private withRelations() { return this.repository.createQueryBuilder('prestamo').leftJoinAndSelect('prestamo.cliente', 'cliente').leftJoinAndSelect('prestamo.periodicidadPago', 'periodicidadPago').leftJoinAndSelect('prestamo.formaPago', 'formaPago'); }
  async guardar(prestamo: Prestamo): Promise<PrestamoConRelaciones> { const saved = await this.repository.save(PrestamoMapper.toOrm(prestamo)); return this.buscarPorId(saved.id) as Promise<PrestamoConRelaciones>; }
  async buscarPorId(id: number): Promise<PrestamoConRelaciones | null> { const entity = await this.withRelations().where('prestamo.id = :id', { id }).getOne(); return entity ? PrestamoMapper.toDomain(entity) : null; }
  async actualizar(prestamo: Prestamo): Promise<PrestamoConRelaciones> { const saved = await this.repository.save(PrestamoMapper.toOrm(prestamo)); return this.buscarPorId(saved.id) as Promise<PrestamoConRelaciones>; }
  async listar(filtros: FiltrosPrestamos): Promise<PrestamosPaginados> {
    const query = this.withRelations();
    if (filtros.buscar?.trim()) {
      const term = `%${filtros.buscar.trim()}%`;
      query.andWhere(new Brackets((where) => where.where('cliente.identificacion ILIKE :term', { term }).orWhere('cliente.primer_nombre ILIKE :term', { term }).orWhere('cliente.segundo_nombre ILIKE :term', { term }).orWhere('cliente.primer_apellido ILIKE :term', { term }).orWhere('cliente.segundo_apellido ILIKE :term', { term })));
    }
    if (filtros.estado !== undefined) query.andWhere('prestamo.estado = :estado', { estado: filtros.estado });
    if (filtros.clienteId !== undefined) query.andWhere('prestamo.cliente_id = :clienteId', { clienteId: filtros.clienteId });
    query.orderBy('prestamo.fecha_alta', 'DESC').addOrderBy('prestamo.id', 'DESC').skip((filtros.pagina - 1) * filtros.limite).take(filtros.limite);
    const [entities, total] = await query.getManyAndCount();
    return { datos: entities.map((entity) => PrestamoMapper.toDomain(entity)), pagina: filtros.pagina, limite: filtros.limite, total, totalPaginas: Math.ceil(total / filtros.limite) };
  }
}
