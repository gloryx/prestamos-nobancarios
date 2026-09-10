import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Refinanciamiento } from '../../../domain/entities/refinanciamiento';
import { FiltrosRefinanciamientos, FiltrosRefinanciamientosReporte, RefinanciamientoConRelaciones, RefinanciamientoRepository, RefinanciamientosPaginados } from '../../../domain/repositories/refinanciamiento.repository';
import { RefinanciamientoMapper } from './refinanciamiento.mapper';
import { RefinanciamientoOrmEntity } from './refinanciamiento.orm-entity';
import { PagoOrmEntity } from '../../../../pagos/infrastructure/persistence/typeorm/pago.orm-entity';
import { PlanPagoOrmEntity } from '../../../../planes-pago/infrastructure/persistence/typeorm/plan-pago.orm-entity';
import { ClienteOrmEntity } from '../../../../clientes/infrastructure/persistence/typeorm/cliente.orm-entity';
import { PrestamoOrmEntity } from '../../../../prestamos/infrastructure/persistence/typeorm/prestamo.orm-entity';
import { ClienteMapper } from '../../../../clientes/infrastructure/persistence/typeorm/cliente.mapper';
import { DatosCadenasCliente, PrestamoCadena } from '../../../domain/repositories/refinanciamiento.repository';
const dbDate = (value: string | Date): Date => value instanceof Date ? new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())) : new Date(`${value}T00:00:00.000Z`);
@Injectable()
export class RefinanciamientoTypeOrmRepository implements RefinanciamientoRepository {
  constructor(@InjectRepository(RefinanciamientoOrmEntity) private readonly repository: Repository<RefinanciamientoOrmEntity>) {}
  private query() { return this.repository.createQueryBuilder('ref').leftJoinAndSelect('ref.prestamoOrigen', 'origen').leftJoinAndSelect('origen.cliente', 'clienteOrigen').leftJoinAndSelect('origen.periodicidadPago', 'periodicidadOrigen').leftJoinAndSelect('origen.formaPago', 'formaOrigen').leftJoinAndSelect('origen.formaDesembolso', 'formaDesembolsoOrigen').leftJoinAndSelect('ref.prestamoNuevo', 'nuevo').leftJoinAndSelect('nuevo.cliente', 'clienteNuevo').leftJoinAndSelect('nuevo.periodicidadPago', 'periodicidadNuevo').leftJoinAndSelect('nuevo.formaPago', 'formaNuevo').leftJoinAndSelect('nuevo.formaDesembolso', 'formaDesembolsoNuevo'); }
  private async detalleCompleto(value: RefinanciamientoConRelaciones): Promise<RefinanciamientoConRelaciones> {
    const [pagosOrigen, pagosNuevo, planNuevo] = await Promise.all([
      this.repository.manager.getRepository(PagoOrmEntity).find({ where: { prestamoId: value.prestamoOrigenId, estado: 'REGISTRADO' as any }, order: { fecha: 'ASC', id: 'ASC' } }),
      this.repository.manager.getRepository(PagoOrmEntity).find({ where: { prestamoId: value.prestamoNuevoId, estado: 'REGISTRADO' as any }, order: { fecha: 'ASC', id: 'ASC' } }),
      this.repository.manager.getRepository(PlanPagoOrmEntity).find({ where: { prestamoId: value.prestamoNuevoId }, order: { numeroPago: 'ASC' } }),
    ]);
    return Object.assign(value, {
      pagosOrigen: pagosOrigen.map(p => ({ id: p.id, monto: p.monto, capitalAplicado: p.capitalAplicado, interesAplicado: p.interesAplicado, fecha: dbDate(p.fecha) })),
      pagosNuevo: pagosNuevo.map(p => ({ id: p.id, monto: p.monto, capitalAplicado: p.capitalAplicado, interesAplicado: p.interesAplicado, fecha: dbDate(p.fecha) })),
      planNuevo: planNuevo.map(p => ({ id: p.id, numeroPago: p.numeroPago, fechaVencimiento: dbDate(p.fechaVencimiento), montoProgramado: p.montoProgramado })),
    });
  }
  async guardar(v: Refinanciamiento): Promise<RefinanciamientoConRelaciones> { const saved = await this.repository.save(RefinanciamientoMapper.toOrm(v)); return (await this.buscarPorId(saved.id))!; }
  async buscarPorId(id: number) { const e = await this.query().where('ref.id = :id', { id }).getOne(); return e ? this.detalleCompleto(RefinanciamientoMapper.toDomain(e)) : null; }
  async buscarPorPrestamoOrigenId(id: number) { const e = await this.query().where('ref.prestamo_origen_id = :id', { id }).getOne(); return e ? this.detalleCompleto(RefinanciamientoMapper.toDomain(e)) : null; }
  async buscarPorPrestamoNuevoId(id: number) { const e = await this.query().where('ref.prestamo_nuevo_id = :id', { id }).getOne(); return e ? this.detalleCompleto(RefinanciamientoMapper.toDomain(e)) : null; }
  async existePorPrestamoOrigenId(id: number) { return (await this.repository.count({ where: { prestamoOrigenId: id } })) > 0; }
  async existePorPrestamoNuevoId(id: number) { return (await this.repository.count({ where: { prestamoNuevoId: id } })) > 0; }
  private applyFilters(q: ReturnType<RefinanciamientoTypeOrmRepository['query']>, f: FiltrosRefinanciamientosReporte) { if (f.buscar?.trim()) { const t = `%${f.buscar.trim()}%`; q.andWhere(new Brackets(w => w.where('origen.id::text ILIKE :t', { t }).orWhere('nuevo.id::text ILIKE :t', { t }).orWhere('clienteOrigen.identificacion ILIKE :t', { t }).orWhere('clienteOrigen.primer_nombre ILIKE :t', { t }).orWhere('clienteOrigen.primer_apellido ILIKE :t', { t }).orWhere('clienteNuevo.identificacion ILIKE :t', { t }).orWhere('clienteNuevo.primer_nombre ILIKE :t', { t }).orWhere('clienteNuevo.primer_apellido ILIKE :t', { t }))); } if (f.clienteId !== undefined) q.andWhere('origen.cliente_id = :clienteId', { clienteId: f.clienteId }); if (f.fechaDesde) q.andWhere('ref.fecha >= :desde', { desde: f.fechaDesde }); if (f.fechaHasta) q.andWhere('ref.fecha <= :hasta', { hasta: f.fechaHasta }); return q; }
  private orderedQuery(f: FiltrosRefinanciamientosReporte) { return this.applyFilters(this.query(), f).orderBy('ref.fecha', 'DESC').addOrderBy('ref.id', 'DESC'); }
  async listar(f: FiltrosRefinanciamientos): Promise<RefinanciamientosPaginados> { const [e, total] = await this.orderedQuery(f).skip((f.pagina - 1) * f.limite).take(Math.min(f.limite, 100)).getManyAndCount(); return { datos: e.map(RefinanciamientoMapper.toDomain), pagina: f.pagina, limite: f.limite, total, totalPaginas: Math.ceil(total / f.limite) }; }
  async listarReporte(f: FiltrosRefinanciamientosReporte): Promise<RefinanciamientoConRelaciones[]> { const entities = await this.orderedQuery(f).getMany(); return entities.map(RefinanciamientoMapper.toDomain); }
  async buscarDatosCadenasPorClienteId(clienteId: number): Promise<DatosCadenasCliente | null> {
    const manager = this.repository.manager;
    const cliente = await manager.getRepository(ClienteOrmEntity).findOne({ where: { id: clienteId } });
    if (!cliente) return null;
    const prestamos = await manager.getRepository(PrestamoOrmEntity).find({ where: { clienteId }, order: { fechaAlta: 'ASC', id: 'ASC' } });
    const refinanciamientos = await this.repository.createQueryBuilder('ref')
      .innerJoinAndSelect('ref.prestamoOrigen', 'origen')
      .innerJoinAndSelect('ref.prestamoNuevo', 'nuevo')
      .where('origen.cliente_id = :clienteId OR nuevo.cliente_id = :clienteId', { clienteId })
      .orderBy('ref.fecha', 'ASC').addOrderBy('ref.id', 'ASC')
      .getMany();
    const prestamoIds = [...new Set(refinanciamientos.flatMap(ref => [ref.prestamoOrigenId, ref.prestamoNuevoId]))];
    const pagosPorPrestamo: Record<number, number> = {};
    if (prestamoIds.length) {
      const rows = await manager.createQueryBuilder()
        .select('pago.prestamo_id', 'prestamoId')
        .addSelect('COALESCE(SUM(pago.monto), 0)', 'monto')
        .from(PagoOrmEntity, 'pago')
        .where('pago.prestamo_id IN (:...prestamoIds)', { prestamoIds })
        .andWhere('pago.estado = :estado', { estado: 'REGISTRADO' })
        .groupBy('pago.prestamo_id')
        .getRawMany<{ prestamoId: string; monto: string }>();
      for (const row of rows) pagosPorPrestamo[Number(row.prestamoId)] = Number(row.monto);
    }
    return {
      cliente: ClienteMapper.toDomain(cliente),
      prestamos: prestamos.map((p): PrestamoCadena => ({ id: p.id, clienteId: p.clienteId, estado: p.estado, fechaAlta: dbDate(p.fechaAlta), capital: p.capital, interes: p.interes, montoTotal: p.montoTotal, montoDesembolsado: p.montoDesembolsado })),
      refinanciamientos: refinanciamientos.map(RefinanciamientoMapper.toDomain),
      pagosPorPrestamo,
    };
  }
}
