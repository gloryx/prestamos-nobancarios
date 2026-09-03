import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PLAN_PAGO_REPOSITORY, PlanPagoRepository } from '../../../planes-pago/domain/repositories/plan-pago.repository';
import { PRESTAMO_REPOSITORY, PrestamoRepository } from '../../../prestamos/domain/repositories/prestamo.repository';
import { PAGO_REPOSITORY, PagoRepository } from '../../domain/repositories/pago.repository';
import { EstadoPlanQueryDto } from '../dto/estado-plan-query.dto';

const todayUtc = (): string => new Date().toISOString().slice(0, 10);
const dateText = (date: Date): string => date.toISOString().slice(0, 10);
const cents = (value: number): number => Math.round(value * 100);
const isValidDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

@Injectable()
export class ObtenerEstadoPlanUseCase {
  constructor(@Inject(PLAN_PAGO_REPOSITORY) private readonly planes: PlanPagoRepository, @Inject(PAGO_REPOSITORY) private readonly pagos: PagoRepository, @Inject(PRESTAMO_REPOSITORY) private readonly prestamos: PrestamoRepository) {}
  async execute(prestamoId: number, query: EstadoPlanQueryDto = {}) {
    if (!(await this.prestamos.buscarPorId(prestamoId))) throw new NotFoundException('Préstamo no encontrado.');
    const plan = await this.planes.buscarPorPrestamoId(prestamoId); if (!plan.length) throw new NotFoundException('Plan de pago no encontrado.');
    const asOf = query.fecha ?? todayUtc();
    if (!isValidDate(asOf)) throw new BadRequestException('La fecha debe ser una fecha calendario válida en formato YYYY-MM-DD.');
    const orderedPlan = [...plan].sort((a, b) => a.numeroPago - b.numeroPago);
    const esperado = orderedPlan.filter((cuota) => dateText(cuota.fechaVencimiento) <= asOf).reduce((sum, cuota) => sum + cents(cuota.montoProgramado), 0);
    const pagos = await this.pagos.listarPorPrestamo(prestamoId);
    const pagadoHastaFecha = pagos.filter((pago) => dateText(pago.fecha) <= asOf).reduce((sum, pago) => sum + cents(pago.monto), 0);
    const totalPagado = pagos.reduce((sum, pago) => sum + cents(pago.monto), 0);
    const prestamo = await this.prestamos.buscarPorId(prestamoId);
    const diferencia = esperado - pagadoHastaFecha;
    const situacion = diferencia > 0 ? 'PENDIENTE' : diferencia < 0 ? 'ADELANTO' : 'AL_DIA';

    let acumulado = 0;
    let proxima = null;
    let acumuladoAnterior = 0;
    for (const cuota of orderedPlan) {
      acumulado += cents(cuota.montoProgramado);
      const esFutura = dateText(cuota.fechaVencimiento) > asOf;
      if (esFutura && pagadoHastaFecha < acumulado) { proxima = { cuota, acumuladoAnterior }; break; }
      acumuladoAnterior = acumulado;
    }
    if (!proxima) {
      acumulado = 0;
      for (const cuota of orderedPlan) {
        acumulado += cents(cuota.montoProgramado);
        if (pagadoHastaFecha < acumulado) { proxima = { cuota, acumuladoAnterior: acumulado - cents(cuota.montoProgramado) }; break; }
      }
    }
    const montoRecomendado = proxima
      ? Math.max(0, cents(proxima.cuota.montoProgramado) + Math.max(0, proxima.acumuladoAnterior - pagadoHastaFecha) - Math.max(0, pagadoHastaFecha - proxima.acumuladoAnterior))
      : 0;
    return {
      prestamoId,
      fechaAnalisis: asOf,
      montoTotal: Number((cents(prestamo.montoTotal) / 100).toFixed(2)),
      totalPagado: totalPagado / 100,
      saldoPendiente: Math.max(0, cents(prestamo.montoTotal) - totalPagado) / 100,
      esperadoAcumulado: esperado / 100,
      pagadoAcumuladoHastaFecha: pagadoHastaFecha / 100,
      diferenciaAcumulada: diferencia / 100,
      situacion,
      proximaCuota: proxima ? { numeroPago: proxima.cuota.numeroPago, fechaVencimiento: dateText(proxima.cuota.fechaVencimiento), montoOriginal: cents(proxima.cuota.montoProgramado) / 100, montoRecomendado: montoRecomendado / 100 } : null,
    };
  }
}
