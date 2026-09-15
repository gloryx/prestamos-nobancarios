import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RentabilidadCanceladosRepository, RentabilidadCanceladaFact } from '../../../domain/repositories/rentabilidad-cancelados.repository';

const serializeDateOnly = (value: unknown): string => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    // PostgreSQL DATE is a calendar date; local getters avoid shifting it through UTC.
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  if (typeof value !== 'string') return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(value.trim());
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
};

@Injectable()
export class RentabilidadCanceladosTypeOrmRepository implements RentabilidadCanceladosRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async listar(anio: number, mes: number): Promise<RentabilidadCanceladaFact[]> {
    const from = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const to = new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10);
    const rows = await this.dataSource.createQueryBuilder()
      .from('prestamo', 'prestamo')
      .innerJoin('prestamo_estado_historial', 'historial', "historial.prestamo_id = prestamo.id AND historial.estado_nuevo = :cancelado AND historial.id = (SELECT h2.id FROM prestamo_estado_historial h2 WHERE h2.prestamo_id = prestamo.id AND h2.estado_nuevo = :cancelado ORDER BY h2.fecha DESC, h2.id DESC LIMIT 1)")
      .leftJoin('(SELECT pago.prestamo_id, SUM(pago.interes_aplicado) AS ganancia FROM pago pago WHERE pago.estado = :registrado GROUP BY pago.prestamo_id)', 'pagos', 'pagos.prestamo_id = prestamo.id')
      .select('prestamo.capital', 'capital')
      .addSelect('prestamo.fecha_alta', 'fechaAlta')
      .addSelect('historial.fecha', 'fechaCancelacion')
      .addSelect('COALESCE(pagos.ganancia, 0)', 'ganancia')
      .where('prestamo.estado = :cancelado')
      .andWhere('historial.fecha >= :from')
      .andWhere('historial.fecha <= :to')
      .setParameters({ cancelado: 'CANCELADO', registrado: 'REGISTRADO', from, to })
       .getRawMany<Record<string, unknown>>();
    return rows.map((row) => ({ capital: Number(row.capital ?? 0), ganancia: Number(row.ganancia ?? 0), fechaAlta: serializeDateOnly(row.fechaAlta), fechaCancelacion: serializeDateOnly(row.fechaCancelacion) }));
  }
}
