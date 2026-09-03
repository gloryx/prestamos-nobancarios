import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PrestamoEstadoHistorial } from '../../../domain/entities/prestamo-estado-historial';
import { PrestamoEstadoHistorialRepository } from '../../../domain/repositories/prestamo-estado-historial.repository';
import { PrestamoEstadoHistorialMapper } from './prestamo-estado-historial.mapper';
import { PrestamoEstadoHistorialOrmEntity } from './prestamo-estado-historial.orm-entity';

@Injectable()
export class PrestamoEstadoHistorialTypeOrmRepository implements PrestamoEstadoHistorialRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}
  private repo(manager: EntityManager): Repository<PrestamoEstadoHistorialOrmEntity> { return manager.getRepository(PrestamoEstadoHistorialOrmEntity); }
  async guardarEnTransaccion(manager: EntityManager, historial: PrestamoEstadoHistorial) { return PrestamoEstadoHistorialMapper.toDomain(await this.repo(manager).save(PrestamoEstadoHistorialMapper.toOrm(historial))); }
  async listarPorPrestamo(prestamoId: number) {
    const rows = await this.repo(this.dataSource.manager).createQueryBuilder('h').leftJoinAndSelect('h.usuario', 'usuario').where('h.prestamo_id = :prestamoId', { prestamoId }).orderBy('h.fecha', 'ASC').addOrderBy('h.id', 'ASC').getMany();
    return rows.map(PrestamoEstadoHistorialMapper.toDomain);
  }
  async estadoDelPrestamoEnFecha(manager: EntityManager, prestamoId: number, fecha: Date) {
    const row = await this.repo(manager).createQueryBuilder('h').where('h.prestamo_id = :prestamoId', { prestamoId }).andWhere('h.fecha <= :fecha', { fecha: fecha.toISOString().slice(0, 10) }).orderBy('h.fecha', 'DESC').addOrderBy('h.id', 'DESC').getOne();
    return row?.estadoNuevo ?? 'DESCONOCIDO';
  }
}
