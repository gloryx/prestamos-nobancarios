import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Pago } from '../../../domain/entities/pago';
import { FiltrosPagos, PagoConRelaciones, PagoRepository, PagosExportacion, PagosPaginados, TotalesPago } from '../../../domain/repositories/pago.repository';
import { PagoMapper } from './pago.mapper';
import { PagoOrmEntity } from './pago.orm-entity';

@Injectable()
export class PagoTypeOrmRepository implements PagoRepository {
  constructor(@InjectRepository(PagoOrmEntity) private readonly repository: Repository<PagoOrmEntity>) {}
  private withRelations() { return this.repository.createQueryBuilder('pago').leftJoinAndSelect('pago.formaPago', 'formaPago').leftJoinAndSelect('pago.cobrador', 'cobrador').leftJoinAndSelect('pago.prestamo', 'prestamo').leftJoinAndSelect('prestamo.cliente', 'cliente').leftJoinAndSelect('pago.planPago', 'planPago').leftJoinAndSelect('pago.anulacion', 'anulacion').leftJoinAndSelect('anulacion.usuario', 'usuarioAnulacion'); }
  async guardar(pago: Pago): Promise<Pago> { return PagoMapper.toDomain(await this.repository.save(PagoMapper.toOrm(pago))); }
  async buscarPorId(id: number): Promise<PagoConRelaciones | null> { const entity = await this.withRelations().where('pago.id = :id', { id }).getOne(); return entity ? PagoMapper.toDomain(entity) : null; }
  async listarPorPrestamo(prestamoId: number): Promise<PagoConRelaciones[]> {
    const query = this.withRelations().where('pago.prestamo_id = :prestamoId', { prestamoId })
      .andWhere('pago.estado IN (:...estados)', { estados: ['REGISTRADO', 'ANULADO'] })
      .addSelect(`CASE WHEN pago.estado = 'REGISTRADO' AND pago.redistribuyo_plan = false
        AND NOT EXISTS (SELECT 1 FROM pago pago_posterior
          WHERE pago_posterior.prestamo_id = pago.prestamo_id
            AND pago_posterior.estado = 'REGISTRADO'
            AND (pago_posterior.fecha > pago.fecha OR (pago_posterior.fecha = pago.fecha AND pago_posterior.id > pago.id)))
        AND NOT EXISTS (SELECT 1 FROM refinanciamiento ref
          WHERE ref.prestamo_origen_id = pago.prestamo_id)
        THEN true ELSE false END`, 'pago_puede_anular')
      .orderBy('pago.fecha', 'DESC').addOrderBy('pago.id', 'DESC');
    const { entities, raw } = await query.getRawAndEntities();
    return entities.map((entity, index) => PagoMapper.toDomain(entity, raw[index]?.pago_puede_anular === true || raw[index]?.pago_puede_anular === 'true'));
  }
  async obtenerTotalesPorPrestamo(prestamoId: number): Promise<TotalesPago> {
    const row = await this.repository.createQueryBuilder('pago').select('COALESCE(SUM(pago.monto), 0)', 'total').addSelect('COALESCE(SUM(pago.capital_aplicado), 0)', 'capital').addSelect('COALESCE(SUM(pago.interes_aplicado), 0)', 'interes').where('pago.prestamo_id = :prestamoId', { prestamoId }).andWhere('pago.estado = :estado', { estado: 'REGISTRADO' }).getRawOne<{ total: string; capital: string; interes: string }>();
    return { total: Number(row?.total ?? 0), capital: Number(row?.capital ?? 0), interes: Number(row?.interes ?? 0) };
  }
  async listar(filtros: FiltrosPagos): Promise<PagosPaginados> {
      const query = this.applyFilters(this.withRelations(), filtros);
       query.orderBy('pago.fecha', 'DESC').addOrderBy('pago.id', 'DESC').skip((filtros.pagina - 1) * filtros.limite).take(Math.min(filtros.limite, 100));
      const [entities, total] = await query.getManyAndCount();
      const row = await this.aggregate(this.applyFilters(this.repository.createQueryBuilder('pago').leftJoin('pago.prestamo', 'prestamo').leftJoin('prestamo.cliente', 'cliente'), filtros, true));
      return { datos: entities.map((entity) => PagoMapper.toDomain(entity)), pagina: filtros.pagina, limite: filtros.limite, total, totalPaginas: Math.ceil(total / filtros.limite), totales: { cantidadPagos: Number(row?.cantidad ?? 0), totalRecibido: Number(row?.total ?? 0), capitalAplicado: Number(row?.capital ?? 0), interesAplicado: Number(row?.interes ?? 0) } };
   }
   async listarParaExportacion(filtros: FiltrosPagos): Promise<PagosExportacion> {
     const [entities, row] = await Promise.all([
       this.applyFilters(this.withRelations(), filtros).orderBy('pago.fecha', 'DESC').addOrderBy('pago.id', 'DESC').getMany(),
       this.aggregate(this.applyFilters(this.repository.createQueryBuilder('pago').leftJoin('pago.prestamo', 'prestamo').leftJoin('prestamo.cliente', 'cliente'), filtros, true)),
     ]);
     return { datos: entities.map((entity) => PagoMapper.toDomain(entity)), totales: { cantidadPagos: Number(row?.cantidad ?? 0), totalRecibido: Number(row?.total ?? 0), capitalAplicado: Number(row?.capital ?? 0), interesAplicado: Number(row?.interes ?? 0) } };
   }
   private applyFilters(target: SelectQueryBuilder<PagoOrmEntity>, filtros: FiltrosPagos, registeredOnly = false) {
     const status = filtros.estado ?? 'REGISTRADO';
     if (registeredOnly || status !== 'TODOS') target.andWhere('pago.estado = :estadoFiltro', { estadoFiltro: registeredOnly ? 'REGISTRADO' : status });
     if (filtros.fechaDesde) target.andWhere('pago.fecha >= :fechaDesde', { fechaDesde: filtros.fechaDesde });
     if (filtros.fechaHasta) target.andWhere('pago.fecha <= :fechaHasta', { fechaHasta: filtros.fechaHasta });
     if (filtros.formaPagoId !== undefined) target.andWhere('pago.forma_pago_id = :formaPagoId', { formaPagoId: filtros.formaPagoId });
     if (filtros.cobradorId !== undefined) target.andWhere('pago.cobrador_id = :cobradorId', { cobradorId: filtros.cobradorId });
     if (filtros.prestamoId !== undefined) target.andWhere('pago.prestamo_id = :prestamoId', { prestamoId: filtros.prestamoId });
     const search = filtros.buscar?.trim();
     if (search) target.andWhere(`(CONCAT_WS(' ', cliente.primer_nombre, cliente.segundo_nombre, cliente.primer_apellido, cliente.segundo_apellido) ILIKE :buscar OR cliente.identificacion ILIKE :buscar OR cliente.telefono1 ILIKE :buscar OR cliente.telefono2 ILIKE :buscar OR CAST(prestamo.id AS TEXT) ILIKE :buscar)`, { buscar: `%${search}%` });
     return target;
   }
   private aggregate(query: SelectQueryBuilder<PagoOrmEntity>) {
     return query.select('COUNT(pago.id)', 'cantidad').addSelect('COALESCE(SUM(pago.monto), 0)', 'total').addSelect('COALESCE(SUM(pago.capital_aplicado), 0)', 'capital').addSelect('COALESCE(SUM(pago.interes_aplicado), 0)', 'interes').getRawOne<{ cantidad: string; total: string; capital: string; interes: string }>();
   }
  async existePagoParaPrestamo(prestamoId: number): Promise<boolean> { return (await this.repository.createQueryBuilder('pago').where('pago.prestamo_id = :prestamoId', { prestamoId }).andWhere('pago.estado = :estado', { estado: 'REGISTRADO' }).getCount()) > 0; }
}
