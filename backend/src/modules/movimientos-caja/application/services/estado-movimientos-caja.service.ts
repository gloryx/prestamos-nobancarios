import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { economicDateOnly } from '../../../../common/economic-date';
import { CierreMensualOrmEntity, ConfiguracionFinancieraOrmEntity, ConceptoDetalleCorte, DetalleCorteMensualOrmEntity } from '../../../cierre-financiero/domain/financial.orm-entities';
import { MOVIMIENTO_CAJA_REPOSITORY, MovimientoCajaRepository, RawEstadoMovimientoCaja } from '../../domain/repositories/movimiento-caja.repository';
import { ConceptoMovimientoCaja } from '../../domain/enums/concepto-movimiento-caja.enum';
import { OrigenSaldoCaja, EstadoMovimientosCajaDto, DesgloseEstadoCajaDto } from '../dto/estado-movimientos-caja.dto';

const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};
const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const nextDay = (value: string) => { const date = new Date(`${value}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10); };
const emptyBreakdown = (): DesgloseEstadoCajaDto => ({ total: 0, pagosClientes: 0, aportesCapital: 0, ajustes: 0, desembolsosPrestamos: 0, desembolsosRefinanciamientos: 0, retiros: 0, gastos: 0, reversos: 0, otros: 0 });

@Injectable()
export class EstadoMovimientosCajaService {
  constructor(private readonly db: DataSource, @Inject(MOVIMIENTO_CAJA_REPOSITORY) private readonly movimientos: MovimientoCajaRepository) {}

  async obtener(fecha?: string): Promise<EstadoMovimientosCajaDto> {
    const config = await this.db.getRepository(ConfiguracionFinancieraOrmEntity).findOne({ where: { singletonKey: 'FINANCIERA' } });
    if (!config) throw new NotFoundException('Configuración financiera no encontrada.');
    const fechaConsulta = fecha ?? economicDateOnly();
    if (!validDate(fechaConsulta)) throw new BadRequestException('La fecha debe ser válida y tener formato YYYY-MM-DD.');
    if (fechaConsulta > economicDateOnly()) throw new BadRequestException('La fecha de consulta no puede ser posterior a la fecha económica actual.');
    if (fechaConsulta < config.fechaApertura) throw new BadRequestException('La fecha de consulta es anterior a la apertura financiera.');
    const close = await this.db.getRepository(CierreMensualOrmEntity).createQueryBuilder('c').where('c.fecha_fin <= :fechaConsulta', { fechaConsulta }).orderBy('c.fecha_fin', 'DESC').getOne();
    const origin = close ? OrigenSaldoCaja.ULTIMO_CIERRE : OrigenSaldoCaja.APERTURA;
    const fechaOrigen = close?.fechaFin ?? config.fechaApertura;
    const details = close ? await this.db.getRepository(DetalleCorteMensualOrmEntity).find({ where: { corteId: close.id } }) : [];
    const snapshot = new Map(details.map(detail => [detail.concepto, detail.monto]));
    const disponibleOrigen = close ? (snapshot.get(ConceptoDetalleCorte.DISPONIBLE_FINAL) ?? 0) : config.disponibleInicial;
    const exactClose = close?.fechaFin === fechaConsulta;
    const aggregate = exactClose ? { rows: [], count: 0 } : await this.movimientos.agregarEstado(close ? nextDay(fechaOrigen) : fechaOrigen, fechaConsulta);
    const breakdown = exactClose ? { entradas: emptyBreakdown(), salidas: emptyBreakdown() } : this.aggregateBreakdown(aggregate.rows);
    const flujoNeto = money(breakdown.entradas.total - breakdown.salidas.total);
    return { fechaConsulta, fechaApertura: config.fechaApertura, origenSaldo: origin, fechaOrigen, disponibleOrigen: money(disponibleOrigen), entradas: breakdown.entradas, salidas: breakdown.salidas, flujoNeto, disponible: money(disponibleOrigen + flujoNeto), cantidadMovimientos: aggregate.count };
  }

  private aggregateBreakdown(rows: RawEstadoMovimientoCaja[]) {
    const entradas = emptyBreakdown(); const salidas = emptyBreakdown();
    for (const row of rows) { const amount = money(Number(row.monto)); const target = row.tipo === 'ENTRADA' ? entradas : salidas; target.total = money(target.total + amount); const field = this.category(row.concepto); target[field] = money(target[field] + amount); }
    return { entradas, salidas };
  }
  private category(concepto: string): keyof DesgloseEstadoCajaDto {
    if (concepto === ConceptoMovimientoCaja.PAGO_CLIENTE) return 'pagosClientes';
    if (concepto === ConceptoMovimientoCaja.APORTE_CAPITAL) return 'aportesCapital';
    if (concepto === ConceptoMovimientoCaja.AJUSTE_ENTRADA || concepto === ConceptoMovimientoCaja.AJUSTE_SALIDA) return 'ajustes';
    if (concepto === ConceptoMovimientoCaja.DESEMBOLSO_PRESTAMO) return 'desembolsosPrestamos';
    if (concepto === ConceptoMovimientoCaja.DESEMBOLSO_REFINANCIAMIENTO) return 'desembolsosRefinanciamientos';
    if (concepto === ConceptoMovimientoCaja.RETIRO) return 'retiros';
    if (concepto === ConceptoMovimientoCaja.GASTO) return 'gastos';
    if (concepto === ConceptoMovimientoCaja.REVERSO) return 'reversos';
    return 'otros';
  }
}
