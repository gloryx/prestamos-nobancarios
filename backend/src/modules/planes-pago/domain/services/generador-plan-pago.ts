import { BadRequestException } from '@nestjs/common';
import { PrestamoConRelaciones } from '../../../prestamos/domain/repositories/prestamo.repository';
import { PlanPago } from '../entities/plan-pago';

const atUtcMidnight = (date: Date): Date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const addDays = (date: Date, days: number): Date => { const result = atUtcMidnight(date); result.setUTCDate(result.getUTCDate() + days); return result; };
const addMonthsClamped = (date: Date): Date => {
  const source = atUtcMidnight(date);
  const month = source.getUTCMonth() + 1;
  const sourceLastDay = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + 1, 0)).getUTCDate();
  const targetLastDay = new Date(Date.UTC(source.getUTCFullYear(), month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(source.getUTCFullYear(), month, source.getUTCDate() === sourceLastDay ? targetLastDay : Math.min(source.getUTCDate(), targetLastDay)));
};

export class GeneradorPlanPago {
  static generar(prestamo: PrestamoConRelaciones): PlanPago[] {
    const periodicidad = prestamo.periodicidadPago?.nombre?.trim().toUpperCase();
    if (!periodicidad || !['DIARIO', 'SEMANAL', 'QUINCENAL', 'MENSUAL'].includes(periodicidad)) {
      throw new BadRequestException('El préstamo no tiene una periodicidad de pago válida para generar el plan.');
    }
    if (!Number.isInteger(prestamo.cantidadPagos) || prestamo.cantidadPagos <= 0) throw new BadRequestException('La cantidad de pagos del préstamo debe ser positiva.');
    const cents = Math.round(prestamo.montoTotal * 100);
    const base = Math.floor(cents / prestamo.cantidadPagos);
    const result: PlanPago[] = [];
    let date = atUtcMidnight(prestamo.fechaAlta);
    for (let index = 1; index <= prestamo.cantidadPagos; index += 1) {
      date = periodicidad === 'DIARIO' ? addDays(date, 1) : periodicidad === 'SEMANAL' ? addDays(date, 7) : periodicidad === 'QUINCENAL' ? addDays(date, 15) : addMonthsClamped(date);
      const amount = index === prestamo.cantidadPagos ? cents - base * (prestamo.cantidadPagos - 1) : base;
      result.push(PlanPago.crear({ prestamoId: prestamo.id!, numeroPago: index, fechaVencimiento: date, montoProgramado: amount / 100 }));
    }
    return result;
  }
}
