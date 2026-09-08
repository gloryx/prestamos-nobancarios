import { BadRequestException } from '@nestjs/common';
import { CuotaPlanPagoDto } from '../dto/cuota-plan-pago.dto';
import { PlanPago } from '../../domain/entities/plan-pago';
import { Prestamo } from '../../../prestamos/domain/entities/prestamo';

type DateValue = Date | string;

const dateText = (value: DateValue) => value instanceof Date ? value.toISOString().slice(0, 10) : value;

export const validarFechaVencimientoPlan = (fechaVencimiento: string, fechaAlta: DateValue, anterior?: DateValue, posterior?: DateValue): Date => {
  const date = new Date(`${fechaVencimiento}T00:00:00.000Z`);
  const previousDate = anterior ? new Date(`${dateText(anterior)}T00:00:00.000Z`) : undefined;
  const nextDate = posterior ? new Date(`${dateText(posterior)}T00:00:00.000Z`) : undefined;
  const loanDate = new Date(`${dateText(fechaAlta)}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaVencimiento) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== fechaVencimiento || date <= loanDate || (previousDate && date <= previousDate) || (nextDate && date >= nextDate)) {
    throw new BadRequestException('Las fechas de vencimiento deben estar en orden cronológico.');
  }
  if (date.getUTCDay() === 0) throw new BadRequestException('Las cuotas del plan de pagos no pueden programarse en domingo.');
  return date;
};

export const convertirYValidarCuotas = (prestamo: Prestamo, cuotas: CuotaPlanPagoDto[]): PlanPago[] => {
  if (cuotas.length !== prestamo.cantidadPagos) throw new BadRequestException('La cantidad de cuotas no coincide con la cantidad de pagos del préstamo.');
  const ordered = [...cuotas].sort((a, b) => a.numeroPago - b.numeroPago);
  if (ordered.some((cuota, index) => cuota.numeroPago !== index + 1)) throw new BadRequestException('La numeración de las cuotas debe ser consecutiva comenzando en 1.');
  const dates: Date[] = [];
  for (const cuota of ordered) dates.push(validarFechaVencimientoPlan(cuota.fechaVencimiento, prestamo.fechaAlta, dates.at(-1)));
  if (ordered.some((cuota) => !Number.isFinite(cuota.montoProgramado) || cuota.montoProgramado <= 0)) throw new BadRequestException('Los montos programados deben ser positivos.');
  const total = Math.round(ordered.reduce((sum, cuota) => sum + Math.round(cuota.montoProgramado * 100), 0));
  if (total !== Math.round(prestamo.montoTotal * 100)) throw new BadRequestException('La suma del plan de pago debe coincidir con el monto total del préstamo.');
  return ordered.map((cuota, index) => PlanPago.crear({ prestamoId: prestamo.id!, numeroPago: index + 1, fechaVencimiento: dates[index], montoProgramado: cuota.montoProgramado }));
};
