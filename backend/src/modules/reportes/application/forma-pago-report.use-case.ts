import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { FormaPagoReportRepository } from '../domain/repositories/forma-pago-report.repository';
import { FORMA_PAGO_REPORT_REPOSITORY } from '../domain/repositories/forma-pago-report.repository';
import type { FormaPagoReportQueryDto } from './dto/forma-pago-report-query.dto';

const cents = (value: string | number | null | undefined): number => {
  const text = String(value ?? '0').trim();
  const negative = text.startsWith('-');
  const unsigned = negative ? text.slice(1) : text;
  const [whole, fraction = ''] = unsigned.split('.');
  const result = Number(whole || 0) * 100 + Number((fraction + '00').slice(0, 2));
  return (negative ? -1 : 1) * result;
};
const money = (value: number) => Number((value / 100).toFixed(2));
const aggregate = (rows: Array<{ formaPagoId: number; formaPagoNombre: string; cantidad: string | number; monto: string | number }>) => rows.map((row) => ({ formaPagoId: row.formaPagoId as number | null, formaPagoNombre: row.formaPagoNombre, cantidad: Number(row.cantidad), monto: money(cents(row.monto)) }));
const totalCents = (rows: Array<{ monto: string | number }>) => rows.reduce((sum, row) => sum + cents(row.monto), 0);

@Injectable()
export class FormaPagoReportUseCase {
  constructor(@Inject(FORMA_PAGO_REPORT_REPOSITORY) private readonly repository: FormaPagoReportRepository) {}

  async execute(query: FormaPagoReportQueryDto) {
    if (query.fechaDesde > query.fechaHasta) throw new BadRequestException('La fecha inicial no puede ser posterior a la fecha final.');
    const [desembolsoRows, pagoRows, unclassified] = await Promise.all([
      this.repository.desembolsos(query.fechaDesde, query.fechaHasta),
      this.repository.pagos(query.fechaDesde, query.fechaHasta),
      this.repository.desembolsosSinForma(query.fechaDesde, query.fechaHasta),
    ]);
    const unclassifiedCents = cents(unclassified.monto);
    const desembolsado = totalCents(desembolsoRows) + unclassifiedCents;
    const recibido = totalCents(pagoRows);
    const desembolsos = aggregate(desembolsoRows);
    if ((Number(unclassified.cantidad) || 0) > 0) {
      desembolsos.push({ formaPagoId: null, formaPagoNombre: 'Sin forma registrada', cantidad: Number(unclassified.cantidad), monto: money(unclassifiedCents) });
    }
    return {
      fechaDesde: query.fechaDesde,
      fechaHasta: query.fechaHasta,
      resumen: {
        totalDesembolsado: money(desembolsado),
        totalRecibido: money(recibido),
        diferencia: money(recibido - desembolsado),
        movimientosDesembolsoSinForma: Number(unclassified.cantidad) || 0,
        montoDesembolsoSinForma: money(unclassifiedCents),
      },
      desembolsos,
      pagos: aggregate(pagoRows),
    };
  }
}
