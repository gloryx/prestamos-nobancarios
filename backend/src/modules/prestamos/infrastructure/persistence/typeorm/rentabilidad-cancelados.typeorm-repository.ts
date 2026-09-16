import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RentabilidadCanceladosRepository, RentabilidadCanceladaFact } from '../../../domain/repositories/rentabilidad-cancelados.repository';
import { sumHistoricalInterest } from '../../../../../common/historical-payment';

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
    const nextMonth = mes === 12 ? `${anio + 1}-01-01` : `${anio}-${String(mes + 1).padStart(2, '0')}-01`;
    const events = await this.dataSource.createQueryBuilder()
      .from('prestamo', 'prestamo')
      .innerJoin('prestamo_estado_historial', 'historial', 'historial.prestamo_id = prestamo.id AND historial.estado_nuevo = :cancelado')
      .select('prestamo.capital', 'capital')
      .addSelect('prestamo.id', 'prestamoId')
      .addSelect('prestamo.fecha_alta', 'fechaAlta')
      .addSelect('historial.fecha', 'fechaCancelacion')
      .addSelect('historial.id', 'historialId')
      .where('historial.fecha >= :from')
      .andWhere('historial.fecha < :nextMonth')
      .setParameters({ cancelado: 'CANCELADO', from, nextMonth })
      .getRawMany<Record<string, unknown>>();

    if (!events.length) return [];

    const ids = [...new Set(events.map(row => Number(row.prestamoId)))];
    const payments = await this.dataSource.createQueryBuilder()
      .from('pago', 'pago')
      .leftJoin('pago_anulacion', 'anulacion', 'anulacion.pago_id = pago.id')
      .select('pago.prestamo_id', 'prestamoId')
      .addSelect('pago.fecha', 'fecha')
      .addSelect('pago.estado', 'estado')
      .addSelect('pago.interes_aplicado', 'interesAplicado')
      .addSelect('anulacion.fecha', 'anulacionFecha')
      .where('pago.prestamo_id IN (:...ids)', { ids })
      .getRawMany<Record<string, unknown>>();

    const byLoan = new Map<number, Array<{ fecha: string; estado: string; interesAplicado: number; anulacionFecha: string | null }>>();
    for (const row of payments) {
      const prestamoId = Number(row.prestamoId);
      const payment = { fecha: serializeDateOnly(row.fecha), estado: String(row.estado ?? ''), interesAplicado: Number(row.interesAplicado ?? 0), anulacionFecha: serializeDateOnly(row.anulacionFecha) || null };
      const list = byLoan.get(prestamoId) ?? [];
      list.push(payment);
      byLoan.set(prestamoId, list);
    }

    return events.map(row => {
      const fechaCancelacion = serializeDateOnly(row.fechaCancelacion);
      const ganancia = sumHistoricalInterest(byLoan.get(Number(row.prestamoId)) ?? [], fechaCancelacion);
      return { capital: Number(row.capital ?? 0), ganancia, fechaAlta: serializeDateOnly(row.fechaAlta), fechaCancelacion };
    });
  }
}
