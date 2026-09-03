import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Refinanciamiento } from '../../../domain/entities/refinanciamiento';
import { FiltrosRefinanciamientos, RefinanciamientoConRelaciones, RefinanciamientoRepository, RefinanciamientosPaginados } from '../../../domain/repositories/refinanciamiento.repository';
import { RefinanciamientoMapper } from './refinanciamiento.mapper';
import { RefinanciamientoOrmEntity } from './refinanciamiento.orm-entity';
import { PagoOrmEntity } from '../../../../pagos/infrastructure/persistence/typeorm/pago.orm-entity';
import { PlanPagoOrmEntity } from '../../../../planes-pago/infrastructure/persistence/typeorm/plan-pago.orm-entity';
const dbDate = (value: string | Date): Date => value instanceof Date ? new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())) : new Date(`${value}T00:00:00.000Z`);
@Injectable()
export class RefinanciamientoTypeOrmRepository implements RefinanciamientoRepository {
  constructor(@InjectRepository(RefinanciamientoOrmEntity) private readonly repository: Repository<RefinanciamientoOrmEntity>) {}
  private query() { return this.repository.createQueryBuilder('ref').leftJoinAndSelect('ref.prestamoOrigen', 'origen').leftJoinAndSelect('origen.cliente', 'clienteOrigen').leftJoinAndSelect('origen.periodicidadPago', 'periodicidadOrigen').leftJoinAndSelect('origen.formaPago', 'formaOrigen').leftJoinAndSelect('ref.prestamoNuevo', 'nuevo').leftJoinAndSelect('nuevo.cliente', 'clienteNuevo').leftJoinAndSelect('nuevo.periodicidadPago', 'periodicidadNuevo').leftJoinAndSelect('nuevo.formaPago', 'formaNuevo'); }
  private async detalleCompleto(value: RefinanciamientoConRelaciones): Promise<RefinanciamientoConRelaciones> {
    const [pagosOrigen, pagosNuevo, planNuevo] = await Promise.all([
      this.repository.manager.getRepository(PagoOrmEntity).find({ where: { prestamoId: value.prestamoOrigenId }, order: { fecha: 'ASC', id: 'ASC' } }),
      this.repository.manager.getRepository(PagoOrmEntity).find({ where: { prestamoId: value.prestamoNuevoId }, order: { fecha: 'ASC', id: 'ASC' } }),
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
  async listar(f: FiltrosRefinanciamientos): Promise<RefinanciamientosPaginados> { const q = this.query(); if (f.buscar?.trim()) { const t = `%${f.buscar.trim()}%`; q.andWhere(new Brackets(w => w.where('origen.id::text ILIKE :t', { t }).orWhere('nuevo.id::text ILIKE :t', { t }).orWhere('clienteOrigen.identificacion ILIKE :t', { t }).orWhere('clienteOrigen.primer_nombre ILIKE :t', { t }).orWhere('clienteOrigen.primer_apellido ILIKE :t', { t }).orWhere('clienteNuevo.identificacion ILIKE :t', { t }).orWhere('clienteNuevo.primer_nombre ILIKE :t', { t }).orWhere('clienteNuevo.primer_apellido ILIKE :t', { t }))); } if (f.clienteId !== undefined) q.andWhere('origen.cliente_id = :clienteId', { clienteId: f.clienteId }); if (f.fechaDesde) q.andWhere('ref.fecha >= :desde', { desde: f.fechaDesde }); if (f.fechaHasta) q.andWhere('ref.fecha <= :hasta', { hasta: f.fechaHasta }); q.orderBy('ref.fecha', 'DESC').addOrderBy('ref.id', 'DESC').skip((f.pagina - 1) * f.limite).take(Math.min(f.limite, 100)); const [e, total] = await q.getManyAndCount(); return { datos: e.map(RefinanciamientoMapper.toDomain), pagina: f.pagina, limite: f.limite, total, totalPaginas: Math.ceil(total / f.limite) }; }
}
