import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { EstadisticaClienteRow, EstadisticasClientesRepository } from '../domain/repositories/estadisticas-clientes.repository';

@Injectable()
export class EstadisticasClientesTypeOrmRepository implements EstadisticasClientesRepository {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async listar(): Promise<EstadisticaClienteRow[]> {
    /*
     * The loan disbursement rule follows the client financial analysis: each
     * prestamo.monto_desembolsado is real money. A refinancing stores only its
     * new money in the new loan; capital transferred from the origin is not
     * stored as a second disbursement. Therefore every non-ANULADO loan can be
     * summed once, without joining refinancing rows into the aggregate.
     */
    const rows = await this.db.query(`
      WITH loan_totals AS (
        SELECT
          p.cliente_id,
          COUNT(*) FILTER (WHERE p.estado <> 'ANULADO') AS cantidad_prestamos,
          COALESCE(SUM(p.monto_desembolsado) FILTER (WHERE p.estado <> 'ANULADO'), 0) AS total_prestado
        FROM prestamo p
        GROUP BY p.cliente_id
      ), payment_totals AS (
        SELECT
          p.cliente_id,
          COALESCE(SUM(pg.interes_aplicado) FILTER (WHERE pg.estado = 'REGISTRADO'), 0) AS ganancia_cobrada
        FROM prestamo p
        LEFT JOIN pago pg ON pg.prestamo_id = p.id
        GROUP BY p.cliente_id
      )
      SELECT
        c.id AS "clienteId",
        CONCAT_WS(' ', c.primer_nombre, c.segundo_nombre, c.primer_apellido, c.segundo_apellido) AS cliente,
        c.identificacion AS identificacion,
        COALESCE(lt.cantidad_prestamos, 0)::int AS "cantidadPrestamos",
        COALESCE(lt.total_prestado, 0)::numeric AS "totalPrestado",
        COALESCE(pt.ganancia_cobrada, 0)::numeric AS "gananciaCobrada",
        CONCAT(
          EXTRACT(YEAR FROM AGE(CURRENT_DATE, c.fecha_ingreso))::int,
          CASE WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, c.fecha_ingreso)) = 1 THEN ' año ' ELSE ' años ' END,
          EXTRACT(MONTH FROM AGE(CURRENT_DATE, c.fecha_ingreso))::int,
          CASE WHEN EXTRACT(MONTH FROM AGE(CURRENT_DATE, c.fecha_ingreso)) = 1 THEN ' mes' ELSE ' meses' END
        ) AS antiguedad
      FROM cliente c
      LEFT JOIN loan_totals lt ON lt.cliente_id = c.id
      LEFT JOIN payment_totals pt ON pt.cliente_id = c.id
      ORDER BY c.id ASC
    `) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      clienteId: Number(row.clienteId),
      cliente: String(row.cliente),
      identificacion: String(row.identificacion),
      cantidadPrestamos: Number(row.cantidadPrestamos),
      totalPrestado: Number(row.totalPrestado),
      gananciaCobrada: Number(row.gananciaCobrada),
      antiguedad: String(row.antiguedad),
    }));
  }
}
