import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { Prestamo } from '../../../domain/entities/prestamo';
import { FiltrosPrestamos, PrestamoConRelaciones, PrestamoParaExportacion, PrestamoRepository, PrestamosPaginados, PrestamosResumen } from '../../../domain/repositories/prestamo.repository';
import { PrestamoMapper } from './prestamo.mapper';
import { PrestamoOrmEntity } from './prestamo.orm-entity';

const clientNameExpression = "UPPER(TRIM(CONCAT_WS(' ', cliente.primer_nombre, cliente.segundo_nombre, cliente.primer_apellido, cliente.segundo_apellido)))";
const statePriorityExpression = "CASE prestamo.estado WHEN 'ACTIVO' THEN 1 WHEN 'INCOBRABLE' THEN 2 WHEN 'REFINANCIADO' THEN 3 WHEN 'CANCELADO' THEN 4 ELSE 5 END";
const statePriorityFallbackExpression = "CASE prestamo.estado WHEN 'ACTIVO' THEN 1 WHEN 'INCOBRABLE' THEN 2 WHEN 'REFINANCIADO' THEN 3 WHEN 'CANCELADO' THEN 4 END";

const applyOrdering = (query: SelectQueryBuilder<PrestamoOrmEntity>, filtros: FiltrosPrestamos) => {
  const direction = filtros.direccionOrden ?? 'ASC';
  switch (filtros.ordenarPor) {
    case 'id': query.orderBy('prestamo.id', direction); break;
    case 'cliente': {
      const supportsSelectAlias = typeof query.addSelect === 'function';
      if (supportsSelectAlias) query.addSelect(clientNameExpression, 'cliente_nombre_orden');
      query.orderBy(supportsSelectAlias ? 'cliente_nombre_orden' : clientNameExpression, direction).addOrderBy('prestamo.id', 'DESC');
      break;
    }
    case 'direccion': query.orderBy('cliente.direccion', direction, 'NULLS LAST').addOrderBy('prestamo.id', 'DESC'); break;
    case 'fechaAlta': query.orderBy('prestamo.fecha_alta', direction).addOrderBy('prestamo.id', 'DESC'); break;
    case 'capital': query.orderBy('prestamo.capital', direction).addOrderBy('prestamo.id', 'DESC'); break;
    case 'estado': {
      const supportsSelectAlias = typeof query.addSelect === 'function';
      if (supportsSelectAlias) query.addSelect(statePriorityExpression, 'estado_orden');
      query.orderBy(supportsSelectAlias ? 'estado_orden' : statePriorityFallbackExpression, direction).addOrderBy('prestamo.id', 'DESC');
      break;
    }
    default: query.orderBy('prestamo.fecha_alta', 'DESC').addOrderBy('prestamo.id', 'DESC');
  }
  return query;
};

@Injectable()
export class PrestamoTypeOrmRepository implements PrestamoRepository {
  constructor(@InjectRepository(PrestamoOrmEntity) private readonly repository: Repository<PrestamoOrmEntity>) {}
  private withRelations() { return this.repository.createQueryBuilder('prestamo').leftJoinAndSelect('prestamo.cliente', 'cliente').leftJoinAndSelect('prestamo.periodicidadPago', 'periodicidadPago').leftJoinAndSelect('prestamo.formaPago', 'formaPago').leftJoinAndSelect('prestamo.formaDesembolso', 'formaDesembolso'); }
  async guardar(prestamo: Prestamo): Promise<PrestamoConRelaciones> { const saved = await this.repository.save(PrestamoMapper.toOrm(prestamo)); return this.buscarPorId(saved.id) as Promise<PrestamoConRelaciones>; }
  async buscarPorId(id: number): Promise<PrestamoConRelaciones | null> { const entity = await this.withRelations().where('prestamo.id = :id', { id }).getOne(); return entity ? PrestamoMapper.toDomain(entity) : null; }
  async actualizar(prestamo: Prestamo): Promise<PrestamoConRelaciones> { const saved = await this.repository.save(PrestamoMapper.toOrm(prestamo)); return this.buscarPorId(saved.id) as Promise<PrestamoConRelaciones>; }
  private applyFilters(query: SelectQueryBuilder<PrestamoOrmEntity>, filtros: FiltrosPrestamos) {
    if (filtros.buscar?.trim()) {
      const term = `%${filtros.buscar.trim()}%`;
      query.andWhere(new Brackets((where) => where.where('cliente.identificacion ILIKE :term', { term }).orWhere('cliente.primer_nombre ILIKE :term', { term }).orWhere('cliente.segundo_nombre ILIKE :term', { term }).orWhere('cliente.primer_apellido ILIKE :term', { term }).orWhere('cliente.segundo_apellido ILIKE :term', { term })));
    }
    if (filtros.direccion?.trim()) query.andWhere('cliente.direccion ILIKE :direccion', { direccion: `%${filtros.direccion.trim()}%` });
    if (filtros.estados !== undefined) {
      if (filtros.estados.length) query.andWhere('prestamo.estado IN (:...estados)', { estados: filtros.estados });
      else query.andWhere('1 = 0');
    } else if (filtros.estado !== undefined) query.andWhere('prestamo.estado = :estado', { estado: filtros.estado });
    if (filtros.fechaInicio) query.andWhere('prestamo.fecha_alta >= :fechaInicio', { fechaInicio: filtros.fechaInicio });
    if (filtros.fechaFin) query.andWhere('prestamo.fecha_alta <= :fechaFin', { fechaFin: filtros.fechaFin });
    if (filtros.clienteId !== undefined) query.andWhere('prestamo.cliente_id = :clienteId', { clienteId: filtros.clienteId });
    return query;
  }
  async listar(filtros: FiltrosPrestamos): Promise<PrestamosPaginados> {
    const query = this.applyFilters(this.withRelations(), filtros);
    applyOrdering(query, filtros).skip((filtros.pagina - 1) * filtros.limite).take(filtros.limite);
    const [entities, total] = await query.getManyAndCount();
    return { datos: entities.map((entity) => PrestamoMapper.toDomain(entity)), pagina: filtros.pagina, limite: filtros.limite, total, totalPaginas: Math.ceil(total / filtros.limite) };
  }
  async resumen(filtros: FiltrosPrestamos): Promise<PrestamosResumen> {
    const pagos = this.repository.manager.createQueryBuilder().subQuery()
      .select('pago.prestamo_id', 'prestamo_id')
      .addSelect('SUM(pago.monto)', 'recuperado')
      .from('pago', 'pago')
      .groupBy('pago.prestamo_id');
    const query = this.applyFilters(this.repository.createQueryBuilder('prestamo').leftJoin('prestamo.cliente', 'cliente'), filtros)
      .leftJoin(`(${pagos.getQuery()})`, 'pagos', 'pagos.prestamo_id = prestamo.id')
      .select('COUNT(prestamo.id)', 'total')
      .addSelect('COALESCE(SUM(prestamo.capital), 0)', 'prestado')
      .addSelect('COALESCE(SUM(prestamo.interes), 0)', 'ganancia')
      .addSelect('COALESCE(SUM(pagos.recuperado), 0)', 'recuperado')
      .addSelect('COALESCE(SUM(GREATEST(prestamo.capital + prestamo.interes - COALESCE(pagos.recuperado, 0), 0)), 0)', 'pendiente');
    const raw = await query.getRawOne<{ total: string; prestado: string; ganancia: string; recuperado: string; pendiente: string }>();
    return { total: Number(raw?.total ?? 0), prestado: Number(raw?.prestado ?? 0), ganancia: Number(raw?.ganancia ?? 0), recuperado: Number(raw?.recuperado ?? 0), pendiente: Number(raw?.pendiente ?? 0) };
  }
  async listarParaExportacion(filtros: FiltrosPrestamos): Promise<PrestamoParaExportacion[]> {
    const entities = await this.applyFilters(this.withRelations(), filtros).orderBy('prestamo.fecha_alta', 'DESC').addOrderBy('prestamo.id', 'DESC').getMany();
    if (!entities.length) return [];
    const ids = entities.map((entity) => entity.id);
    const totals = await this.repository.manager.createQueryBuilder().select('pago.prestamo_id', 'prestamo_id').addSelect('SUM(pago.monto)', 'recuperado').from('pago', 'pago').where('pago.prestamo_id IN (:...ids)', { ids }).groupBy('pago.prestamo_id').getRawMany<{ prestamo_id: string; recuperado: string }>();
    const recovered = new Map(totals.map((row) => [Number(row.prestamo_id), Number(row.recuperado)]));
    return entities.map((entity) => Object.assign(PrestamoMapper.toDomain(entity), { recuperado: recovered.get(entity.id) ?? 0 }));
  }
}
