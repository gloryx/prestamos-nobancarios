import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CLIENTE_REPOSITORY, ClienteRepository } from '../../domain/repositories/cliente.repository';
import { ANALISIS_FINANCIERO_REPOSITORY, AnalisisFinancieroRepository, AnalisisPago, AnalisisPrestamo } from '../../domain/repositories/analisis-financiero.repository';
import { EstadoPrestamo } from '../../../prestamos/domain/enums/estado-prestamo.enum';
import { calcularFechaLimiteContractual, fechaDateOnly } from '../../../planes-pago/domain/services/calendario-pago';
import { calcularIndicadorCobranza } from '../../../prestamos/application/services/indicador-cobranza.service';

const money = (value: number): number => Math.max(0, Math.round((value + Number.EPSILON) * 100) / 100);
const today = (): string => fechaDateOnly(new Date());
const daysBetween = (from: Date, to: string): number => Math.max(0, Math.floor((Date.parse(`${to}T00:00:00Z`) - from.getTime()) / 86400000));

@Injectable()
export class ObtenerAnalisisFinancieroUseCase {
  constructor(@Inject(CLIENTE_REPOSITORY) private readonly clientes: ClienteRepository, @Inject(ANALISIS_FINANCIERO_REPOSITORY) private readonly repository: AnalisisFinancieroRepository) {}

  async execute(id: number) {
    const cliente = await this.clientes.buscarPorId(id);
    if (!cliente) throw new NotFoundException('Cliente no encontrado.');
    const prestamos = await this.repository.listarPrestamos(id);
    if (!prestamos.length) return { cliente: this.cliente(cliente), resumen: { totalPrestado: 0, totalPagado: 0, pendiente: 0, ganancia: 0, cantidadPrestamos: 0 }, prestamos: [] };
    const ids = prestamos.map((p) => p.id);
    const hoy = today();
    const [totales, ultimos, pagosOrdenados, refinanciamientos, vencidos] = await Promise.all([
      this.repository.obtenerTotalesPagos(ids), this.repository.listarUltimosPagos(ids), this.repository.listarPagosOrdenados(ids),
      this.repository.listarRefinanciamientos(ids), this.repository.listarObligacionesVencidas(ids, hoy),
    ]);
    const totals = new Map(totales.map((p) => [p.prestamoId, p]));
    const latest = new Map(ultimos.map((p) => [p.prestamoId, p]));
    const refinance = new Map(refinanciamientos.map((r) => [r.prestamoOrigenId, r.fecha]));
    const overdue = new Set(vencidos);
    const byLoan = new Map<number, AnalisisPago[]>();
    for (const pago of pagosOrdenados) byLoan.set(pago.prestamoId, [...(byLoan.get(pago.prestamoId) ?? []), pago]);
    const result = prestamos.map((prestamo) => this.mapPrestamo(prestamo, totals.get(prestamo.id), latest.get(prestamo.id), byLoan.get(prestamo.id) ?? [], refinance.get(prestamo.id), overdue.has(prestamo.id), hoy));
    return { cliente: this.cliente(cliente), resumen: { totalPrestado: money(result.reduce((s, p) => s + p.capital, 0)), totalPagado: money(result.reduce((s, p) => s + p.totalPagado, 0)), pendiente: money(result.reduce((s, p) => s + p.saldoPendiente, 0)), ganancia: money(result.reduce((s, p) => s + p.interes, 0)), cantidadPrestamos: result.length }, prestamos: result };
  }

  private cliente(c: any) { return { id: c.id!, identificacion: c.identificacion, nombreCompleto: [c.primerNombre, c.segundoNombre, c.primerApellido, c.segundoApellido].filter(Boolean).join(' '), telefono1: c.telefono1, telefono2: c.telefono2 }; }
  private mapPrestamo(p: AnalisisPrestamo, t: any, latest: AnalisisPago | undefined, ordered: AnalisisPago[], refinanceDate: string | undefined, overdue: boolean, hoy: string) {
    const totalPagado = money(t?.monto ?? 0), capitalPagado = money(t?.capital ?? 0), interesPagado = money(t?.interes ?? 0);
    const capitalPendiente = money(Math.max(p.capital - capitalPagado, 0)), interesPendiente = money(Math.max(p.interes - interesPagado, 0));
    const saldoPendiente = money(Math.max(p.montoTotal - totalPagado, 0));
    const fechaLimiteContractual = calcularFechaLimiteContractual(p.fechaAlta, p.periodicidad, p.cantidadPagos);
    let duracionDias: number; let tipoDuracion: 'FINALIZADO' | 'TRANSCURRIDOS';
    if (p.estado === EstadoPrestamo.REFINANCIADO) { duracionDias = daysBetween(p.fechaAlta, refinanceDate!); tipoDuracion = 'FINALIZADO'; }
    else if (p.estado === EstadoPrestamo.CANCELADO) { let capital = 0; let interes = 0; let event: string | undefined; for (const pago of ordered) { capital += pago.capitalAplicado; interes += pago.interesAplicado; if (capital >= p.capital && interes >= p.interes) { event = pago.fecha; break; } } duracionDias = daysBetween(p.fechaAlta, event ?? hoy); tipoDuracion = 'FINALIZADO'; }
    else { duracionDias = daysBetween(p.fechaAlta, hoy); tipoDuracion = 'TRANSCURRIDOS'; }
    return { id: p.id, estado: p.estado, fechaAlta: fechaDateOnly(p.fechaAlta), capital: money(p.capital), interes: money(p.interes), montoTotal: money(p.montoTotal), totalPagado, capitalPagado, interesPagado, capitalPendiente, interesPendiente, saldoPendiente, indicadorCobranza: calcularIndicadorCobranza(saldoPendiente, fechaLimiteContractual, hoy, overdue), fechaLimiteContractual, ultimoPago: latest ? { fecha: latest.fecha, monto: money(latest.monto) } : null, duracionDias, tipoDuracion };
  }
}
