import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CobrosDelDiaQuery } from '../dto/cobros-del-dia-query.dto';
import { COBROS_DEL_DIA_REPOSITORY, CobrosDelDiaRepository } from '../../domain/repositories/cobros-del-dia.repository';

const validDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};
const sumMoney = (values: number[]): number => values.reduce((cents, value) => cents + Math.round(value * 100), 0) / 100;

@Injectable()
export class ConsultarCobrosDelDiaUseCase {
  constructor(@Inject(COBROS_DEL_DIA_REPOSITORY) private readonly repository: CobrosDelDiaRepository) {}

  async execute(query: CobrosDelDiaQuery) {
    const hasSingle = query.fecha !== undefined;
    const hasRange = query.fechaDesde !== undefined || query.fechaHasta !== undefined;
    if ((!hasSingle && !query.fechaDesde) || (!hasSingle && !query.fechaHasta) || (hasSingle && hasRange)) {
      throw new BadRequestException('Provide fecha or both fechaDesde and fechaHasta.');
    }
    const dates = [query.fecha, query.fechaDesde, query.fechaHasta].filter((value): value is string => value !== undefined);
    if (dates.some((date) => !validDate(date))) throw new BadRequestException('Dates must be valid YYYY-MM-DD values.');
    if (query.fechaDesde && query.fechaHasta && query.fechaDesde > query.fechaHasta) throw new BadRequestException('fechaDesde must be before or equal to fechaHasta.');

    const result = await this.repository.consultar(query);
    return {
      fecha: query.fecha ?? null,
      fechaDesde: query.fechaDesde ?? query.fecha ?? null,
      fechaHasta: query.fechaHasta ?? query.fecha ?? null,
      porCobrar: result.porCobrar,
      pagaron: result.pagaron,
      totales: {
        porCobrar: { cantidad: result.porCobrar.length, monto: sumMoney(result.porCobrar.map((row) => row.saldoPendiente)) },
        pagaron: { cantidad: result.pagaron.length, monto: sumMoney(result.pagaron.map((row) => row.monto)) },
      },
    };
  }
}
