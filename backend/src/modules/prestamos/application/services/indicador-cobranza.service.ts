import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { fechaDateOnly, resolveContractualDeadline } from '../../../planes-pago/domain/services/calendario-pago';
import { economicDateOnly } from '../../../../common/economic-date';
import { PagoOrmEntity } from '../../../pagos/infrastructure/persistence/typeorm/pago.orm-entity';
import { PlanPagoOrmEntity } from '../../../planes-pago/infrastructure/persistence/typeorm/plan-pago.orm-entity';
import { PrestamoConRelaciones } from '../../domain/repositories/prestamo.repository';
import { EstadoPrestamo } from '../../domain/enums/estado-prestamo.enum';

export const INDICADORES_COBRANZA = ['AL_DIA', 'ATRASADO', 'PLAZO_CUMPLIDO', 'SALDADO'] as const;
export type IndicadorCobranza = (typeof INDICADORES_COBRANZA)[number];
export interface DatosCobranza { fechaLimiteContractual: string; indicadorCobranza: IndicadorCobranza; }

export function calcularIndicadorCobranza(saldo: number, fechaLimite: string, hoy: string, existeObligacionVencida: boolean): IndicadorCobranza {
  if (saldo <= 0) return 'SALDADO';
  if (hoy >= fechaLimite) return 'PLAZO_CUMPLIDO';
  return existeObligacionVencida ? 'ATRASADO' : 'AL_DIA';
}

@Injectable()
export class IndicadorCobranzaService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async calcular(prestamos: PrestamoConRelaciones[], currentDate?: Date): Promise<Map<number, DatosCobranza>> {
    const ids = prestamos.map((prestamo) => prestamo.id!).filter(Boolean);
    const result = new Map<number, DatosCobranza>();
    if (!ids.length) return result;
    const hoy = currentDate ? economicDateOnly(currentDate) : economicDateOnly();

    const totals = await this.dataSource.getRepository(PagoOrmEntity).createQueryBuilder('pago')
      .select('pago.prestamoId', 'prestamoId').addSelect('COALESCE(SUM(pago.monto), 0)', 'total')
      .where('pago.prestamoId IN (:...ids)', { ids }).andWhere('pago.estado = :state', { state: 'REGISTRADO' }).groupBy('pago.prestamoId').getRawMany<{ prestamoId: string; total: string }>();
    const paidByLoan = new Map(totals.map((row) => [Number(row.prestamoId), Number(row.total)]));

    // Only payments linked through plan_pago count for operational delinquency.
    const overdue = await this.dataSource.getRepository(PlanPagoOrmEntity).createQueryBuilder('plan')
      .leftJoin(PagoOrmEntity, 'pago', "pago.plan_pago_id = plan.id AND pago.estado = 'REGISTRADO'")
      .select('plan.prestamoId', 'prestamoId').where('plan.prestamoId IN (:...ids)', { ids })
      .andWhere('plan.fechaVencimiento < :hoy', { hoy })
      .groupBy('plan.id').addGroupBy('plan.prestamoId').addGroupBy('plan.montoProgramado')
      .having('COALESCE(SUM(pago.monto), 0) < plan.montoProgramado').getRawMany<{ prestamoId: string }>();
    const overdueLoans = new Set(overdue.map((row) => Number(row.prestamoId)));

    const deadlines = await this.dataSource.getRepository(PlanPagoOrmEntity).createQueryBuilder('plan')
      .select('plan.prestamoId', 'prestamoId').addSelect('MAX(plan.fechaVencimiento)', 'fechaLimiteContractual')
      .where('plan.prestamoId IN (:...ids)', { ids }).groupBy('plan.prestamoId').getRawMany<{ prestamoId: string; fechaLimiteContractual: string | Date }>();
    const deadlineByLoan = new Map(deadlines.map((row) => [Number(row.prestamoId), fechaDateOnly(row.fechaLimiteContractual instanceof Date ? row.fechaLimiteContractual : new Date(`${String(row.fechaLimiteContractual).slice(0, 10)}T00:00:00.000Z`))]));

    for (const prestamo of prestamos) {
      if (prestamo.estado === EstadoPrestamo.ANULADO) continue;
      const fechaLimiteContractual = resolveContractualDeadline(deadlineByLoan.get(prestamo.id!), prestamo.fechaAlta, prestamo.periodicidadPago.nombre, prestamo.cantidadPagos);
      const saldo = Math.max(0, prestamo.montoTotal - (paidByLoan.get(prestamo.id!) ?? 0));
      result.set(prestamo.id!, { fechaLimiteContractual, indicadorCobranza: calcularIndicadorCobranza(saldo, fechaLimiteContractual, hoy, overdueLoans.has(prestamo.id!)) });
    }
    return result;
  }
}
