import { BadRequestException } from '@nestjs/common';
import { PrestamoConRelaciones } from '../../../prestamos/domain/repositories/prestamo.repository';
import { PlanPago } from '../entities/plan-pago';
import { calcularFechaLimiteContractual, fechaDateOnly } from './calendario-pago';

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
    let date = new Date(`${fechaDateOnly(prestamo.fechaAlta)}T00:00:00.000Z`);
    for (let index = 1; index <= prestamo.cantidadPagos; index += 1) {
      const deadline = calcularFechaLimiteContractual(prestamo.fechaAlta, periodicidad, index);
      date = new Date(`${deadline}T00:00:00.000Z`);
      const amount = index === prestamo.cantidadPagos ? cents - base * (prestamo.cantidadPagos - 1) : base;
      result.push(PlanPago.crear({ prestamoId: prestamo.id!, numeroPago: index, fechaVencimiento: date, montoProgramado: amount / 100 }));
    }
    return result;
  }
}
