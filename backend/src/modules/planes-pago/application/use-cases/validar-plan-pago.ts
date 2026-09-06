import { BadRequestException } from '@nestjs/common';
import { CuotaPlanPagoDto } from '../dto/cuota-plan-pago.dto';
import { PlanPago } from '../../domain/entities/plan-pago';
import { Prestamo } from '../../../prestamos/domain/entities/prestamo';

export const convertirYValidarCuotas = (prestamo: Prestamo, cuotas: CuotaPlanPagoDto[]): PlanPago[] => {
  if (cuotas.length !== prestamo.cantidadPagos) throw new BadRequestException('La cantidad de cuotas no coincide con la cantidad de pagos del préstamo.');
  const ordered = [...cuotas].sort((a, b) => a.numeroPago - b.numeroPago);
  if (ordered.some((cuota, index) => cuota.numeroPago !== index + 1)) throw new BadRequestException('La numeración de las cuotas debe ser consecutiva comenzando en 1.');
  const dates = ordered.map((cuota) => new Date(`${cuota.fechaVencimiento}T00:00:00.000Z`));
  if (ordered.some((cuota, index) => !/^\d{4}-\d{2}-\d{2}$/.test(cuota.fechaVencimiento) || Number.isNaN(dates[index].getTime()) || dates[index].toISOString().slice(0, 10) !== cuota.fechaVencimiento) || dates.some((date, index) => date <= prestamo.fechaAlta || (index > 0 && date <= dates[index - 1]))) throw new BadRequestException('Las fechas de vencimiento deben estar en orden cronológico.');
  if (dates.some((date) => date.getUTCDay() === 0)) throw new BadRequestException('Las cuotas del plan de pagos no pueden programarse en domingo.');
  if (ordered.some((cuota) => !Number.isFinite(cuota.montoProgramado) || cuota.montoProgramado <= 0)) throw new BadRequestException('Los montos programados deben ser positivos.');
  const total = Math.round(ordered.reduce((sum, cuota) => sum + Math.round(cuota.montoProgramado * 100), 0));
  if (total !== Math.round(prestamo.montoTotal * 100)) throw new BadRequestException('La suma del plan de pago debe coincidir con el monto total del préstamo.');
  return ordered.map((cuota, index) => PlanPago.crear({ prestamoId: prestamo.id!, numeroPago: index + 1, fechaVencimiento: dates[index], montoProgramado: cuota.montoProgramado }));
};
