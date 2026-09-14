import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { EstadoPrestamo } from '../../domain/enums/estado-prestamo.enum';

export type PrestamoAnulacionFlags = { puedeAnular: boolean };

@Injectable()
export class PrestamoAnulacionService {
  async calcular(manager: EntityManager, ids: number[]): Promise<Map<number, PrestamoAnulacionFlags>> {
    const result = new Map<number, PrestamoAnulacionFlags>();
    if (!ids.length) return result;
    const rows = await manager.createQueryBuilder()
      .select('prestamo.id', 'id')
      .addSelect(`(
        prestamo.estado = :activo
        AND COUNT(DISTINCT CASE WHEN pago.estado IN ('REGISTRADO', 'ANULADO') THEN pago.id END) = 0
        AND COUNT(DISTINCT origen.id) = 0
        AND COUNT(DISTINCT resultado.id) = 0
        AND COUNT(DISTINCT desembolso.id) = 1
        AND COUNT(DISTINCT reverso.id) = 0
      )`, 'puede_anular')
      .from('prestamo', 'prestamo')
      .leftJoin('pago', 'pago', 'pago.prestamo_id = prestamo.id')
      .leftJoin('refinanciamiento', 'origen', 'origen.prestamo_origen_id = prestamo.id')
      .leftJoin('refinanciamiento', 'resultado', 'resultado.prestamo_nuevo_id = prestamo.id')
      .leftJoin('movimiento_caja', 'desembolso', "desembolso.prestamo_id = prestamo.id AND desembolso.concepto = 'DESEMBOLSO_PRESTAMO' AND desembolso.movimiento_reversado_id IS NULL")
      .leftJoin('movimiento_caja', 'reverso', "reverso.movimiento_reversado_id = desembolso.id AND reverso.concepto = 'REVERSO'")
      .where('prestamo.id IN (:...ids)', { ids })
      .groupBy('prestamo.id')
      .addGroupBy('prestamo.estado')
      .setParameter('activo', EstadoPrestamo.ACTIVO)
      .getRawMany<{ id: string; puede_anular: boolean | string }>();
    for (const row of rows) result.set(Number(row.id), { puedeAnular: row.puede_anular === true || row.puede_anular === 'true' });
    return result;
  }

  async assertPuedeAnular(manager: EntityManager, id: number): Promise<void> {
    const flags = await this.calcular(manager, [id]);
    if (!flags.get(id)?.puedeAnular) throw new BadRequestException('El préstamo no cumple las condiciones para ser anulado.');
  }
}
