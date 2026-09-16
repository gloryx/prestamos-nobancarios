import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { aggregateAnalisisFinanciero, aggregateComparativoFinanciero, totalAnalisisFinanciero } from './analisis-financiero-aggregation';
import type { AnalisisFinancieroRepository } from '../domain/repositories/analisis-financiero.repository';
import { ANALISIS_FINANCIERO_REPOSITORY } from '../domain/repositories/analisis-financiero.repository';
import { buildProyeccion, type ProyeccionPeriodo } from './proyeccion-aggregation';

const MAX_YEARS = 20;

@Injectable()
export class AnalisisFinancieroUseCase {
  constructor(@Inject(ANALISIS_FINANCIERO_REPOSITORY) private readonly repository: AnalisisFinancieroRepository) {}

  async resumenMensual(anio: number) {
    const meses = aggregateAnalisisFinanciero(anio, await this.repository.pagos(anio, anio), await this.repository.prestamos(anio, anio));
    const { prestamos, pagos, diferencia, ganancia } = totalAnalisisFinanciero(meses, anio);
    return { anio, meses, totales: { prestamos, pagos, diferencia, ganancia } };
  }

  async comparativoAnual(desde: number, hasta: number) {
    if (desde > hasta) throw new BadRequestException('El año desde debe ser menor o igual que hasta.');
    if (hasta - desde + 1 > MAX_YEARS) throw new BadRequestException(`El rango no puede superar ${MAX_YEARS} años.`);
    return { desde, hasta, anios: aggregateComparativoFinanciero(desde, hasta, await this.repository.pagos(desde, hasta), await this.repository.prestamos(desde, hasta)) };
  }

  async proyeccion(periodo = '1m') {
    if (!['15d', '1m', '2m', '3m', 'cartera'].includes(periodo)) throw new BadRequestException('El periodo debe ser 15d, 1m, 2m, 3m o cartera.');
    return buildProyeccion(await this.repository.proyeccion(), periodo as ProyeccionPeriodo);
  }
}
