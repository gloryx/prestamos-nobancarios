import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { PagoOrmEntity } from '../../pagos/infrastructure/persistence/typeorm/pago.orm-entity';
import { EstadoPago } from '../../pagos/domain/enums/estado-pago.enum';
import type { DesempenoCobradorRow, DesempenoCobradoresRepository, DesempenoCobradoresTotalesRow } from '../domain/repositories/desempeno-cobradores.repository';

type Filters = { fechaDesde: string; fechaHasta: string; cobradorId?: number; formaPagoId?: number };

export class DesempenoCobradoresTypeOrmRepository implements DesempenoCobradoresRepository {
  constructor(@InjectRepository(PagoOrmEntity) private readonly pagos: Repository<PagoOrmEntity>) {}

  private base(filters: Filters): SelectQueryBuilder<PagoOrmEntity> {
    const query = this.pagos.createQueryBuilder('pago')
      .innerJoin('pago.cobrador', 'cobrador')
      .innerJoin('pago.prestamo', 'prestamo')
      .innerJoin('prestamo.cliente', 'cliente')
      .where('pago.estado = :estado', { estado: EstadoPago.REGISTRADO })
      .andWhere('pago.fecha >= :fechaDesde AND pago.fecha <= :fechaHasta', filters);
    if (filters.cobradorId !== undefined) query.andWhere('pago.cobrador_id = :cobradorId', { cobradorId: filters.cobradorId });
    if (filters.formaPagoId !== undefined) query.andWhere('pago.forma_pago_id = :formaPagoId', { formaPagoId: filters.formaPagoId });
    return query;
  }

  async agrupar(filters: Filters): Promise<DesempenoCobradorRow[]> {
    const rows = await this.base(filters)
      .select('pago.cobrador_id', 'cobradorId')
      .addSelect('cobrador.nombre_completo', 'cobradorNombre')
      .addSelect('COUNT(pago.id)', 'cantidadPagos')
      .addSelect('SUM(pago.monto)', 'montoRecibido')
      .addSelect('SUM(pago.capital_aplicado)', 'capitalAplicado')
      .addSelect('SUM(pago.interes_aplicado)', 'interesAplicado')
      .addSelect('COUNT(DISTINCT prestamo.cliente_id)', 'cantidadClientes')
      .addSelect('COUNT(DISTINCT pago.prestamo_id)', 'cantidadPrestamos')
      .groupBy('pago.cobrador_id').addGroupBy('cobrador.nombre_completo')
      .orderBy('SUM(pago.monto)', 'DESC').addOrderBy('cobrador.nombre_completo', 'ASC').addOrderBy('pago.cobrador_id', 'ASC')
      .getRawMany<Record<string, unknown>>();
    return rows.map((row) => ({ cobradorId: row.cobradorId == null ? null : Number(row.cobradorId), cobradorNombre: row.cobradorNombre == null ? null : String(row.cobradorNombre), cantidadPagos: Number(row.cantidadPagos) || 0, montoRecibido: Number(row.montoRecibido) || 0, capitalAplicado: Number(row.capitalAplicado) || 0, interesAplicado: Number(row.interesAplicado) || 0, cantidadClientes: Number(row.cantidadClientes) || 0, cantidadPrestamos: Number(row.cantidadPrestamos) || 0 }));
  }

  async totales(filters: Filters): Promise<DesempenoCobradoresTotalesRow> {
    const row = await this.base(filters).select('COUNT(pago.id)', 'cantidadPagos').addSelect('COALESCE(SUM(pago.monto), 0)', 'totalRecibido').addSelect('COALESCE(SUM(pago.capital_aplicado), 0)', 'capitalAplicado').addSelect('COALESCE(SUM(pago.interes_aplicado), 0)', 'interesAplicado').addSelect('COUNT(DISTINCT pago.cobrador_id)', 'cantidadCobradores').getRawOne<Record<string, unknown>>();
    return { cantidadPagos: Number(row?.cantidadPagos) || 0, totalRecibido: Number(row?.totalRecibido) || 0, capitalAplicado: Number(row?.capitalAplicado) || 0, interesAplicado: Number(row?.interesAplicado) || 0, cantidadCobradores: Number(row?.cantidadCobradores) || 0 };
  }
}
