import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CLIENTE_REPOSITORY, ClienteRepository } from '../../domain/repositories/cliente.repository';
import { ANALISIS_FINANCIERO_REPOSITORY, AnalisisFinancieroRepository, AnalisisPago, AnalisisPrestamo, AnalisisRefinanciamiento } from '../../domain/repositories/analisis-financiero.repository';
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
    if (!prestamos.length) return { cliente: this.cliente(cliente), resumen: this.resumen(0, 0, 0, 0, 0, 0, 0), prestamos: [] };
    const ids = prestamos.map((p) => p.id);
    const hoy = today();
    const [totales, ultimos, pagosOrdenados, refinanciamientos, vencidos] = await Promise.all([
      this.repository.obtenerTotalesPagos(ids), this.repository.listarUltimosPagos(ids), this.repository.listarPagosOrdenados(ids),
      this.repository.listarRefinanciamientos(ids), this.repository.listarObligacionesVencidas(ids, hoy),
    ]);
    const totals = new Map(totales.map((p) => [p.prestamoId, p]));
    const latest = new Map(ultimos.map((p) => [p.prestamoId, p]));
    const loanIds = new Set(ids);
    const byOrigin = new Map<number, (typeof refinanciamientos)[number]>();
    const byNew = new Map<number, (typeof refinanciamientos)[number]>();
    for (const relation of refinanciamientos) {
      if (!loanIds.has(relation.prestamoOrigenId) || !loanIds.has(relation.prestamoNuevoId)) throw new ConflictException('Relación de refinanciamiento cruzada entre clientes.');
      if (byOrigin.has(relation.prestamoOrigenId)) throw new ConflictException('Corrupción estructural: un préstamo tiene más de un sucesor.');
      if (byNew.has(relation.prestamoNuevoId)) throw new ConflictException('Corrupción estructural: un préstamo tiene más de un origen.');
      byOrigin.set(relation.prestamoOrigenId, relation); byNew.set(relation.prestamoNuevoId, relation);
    }
    for (const prestamo of prestamos) if (prestamo.estado === EstadoPrestamo.REFINANCIADO && !byOrigin.has(prestamo.id)) throw new ConflictException('Corrupción estructural: préstamo refinanciado sin sucesor.');
    const roots = [...byOrigin.keys()].filter((loanId) => !byNew.has(loanId));
    const seenRelations = new Set<number | string>();
    for (const rootId of roots) {
      const seenLoans = new Set<number>(); let current = rootId;
      while (byOrigin.has(current)) {
        if (seenLoans.has(current)) throw new ConflictException('Corrupción estructural: ciclo en cadena de refinanciamiento.');
        seenLoans.add(current);
        const relation = byOrigin.get(current)!;
        seenRelations.add(relation.id ?? `${relation.prestamoOrigenId}:${relation.prestamoNuevoId}`);
        current = relation.prestamoNuevoId;
      }
    }
    if (seenRelations.size !== refinanciamientos.length) throw new ConflictException('Corrupción estructural: ciclo o componente no alcanzable.');
    const overdue = new Set(vencidos);
    const byLoan = new Map<number, AnalisisPago[]>();
    for (const pago of pagosOrdenados) byLoan.set(pago.prestamoId, [...(byLoan.get(pago.prestamoId) ?? []), pago]);
    const result = prestamos.map((prestamo) => this.mapPrestamo(prestamo, totals.get(prestamo.id), latest.get(prestamo.id), byLoan.get(prestamo.id) ?? [], byOrigin.get(prestamo.id), overdue.has(prestamo.id), hoy));
    const contractual = this.sum(prestamos.map((p) => p.capital));
    const independentIds = prestamos.filter((p) => !byOrigin.has(p.id) && !byNew.has(p.id)).map((p) => p.id);
    const deliveredIds = new Set<number>([...byNew.keys(), ...roots, ...independentIds]);
    const delivered = this.sum(prestamos.filter((p) => deliveredIds.has(p.id)).map((p) => p.montoDesembolsado));
    const received = this.sum(result.map((p) => p.totalPagado));
    const interest = this.sum(result.map((p) => p.interesPagado));
    const terminals = prestamos.filter((p) => !byOrigin.has(p.id));
    const pending = this.sum(terminals.filter((p) => p.estado === EstadoPrestamo.ACTIVO).map((p) => result.find((r) => r.id === p.id)!.saldoPendiente));
    const uncollectible = this.sum(terminals.filter((p) => p.estado === EstadoPrestamo.INCOBRABLE).map((p) => result.find((r) => r.id === p.id)!.saldoPendiente));
    const independent = independentIds.length;
    return { cliente: this.cliente(cliente), resumen: this.resumen(contractual, delivered, received, pending, interest, roots.length, independent, uncollectible, result.length), prestamos: result };
  }

  private cliente(c: any) { return { id: c.id!, identificacion: c.identificacion, nombreCompleto: [c.primerNombre, c.segundoNombre, c.primerApellido, c.segundoApellido].filter(Boolean).join(' '), telefono1: c.telefono1, telefono2: c.telefono2 }; }
  private sum(values: number[]) { return money(values.reduce((sum, value) => sum + money(value), 0)); }
  private resumen(contractual: number, delivered: number, received: number, pending: number, interest: number, chains: number, independent: number, uncollectible = 0, loanCount = 0) { return { montoContractualAcumulado: money(contractual), montoRealmenteEntregado: money(delivered), montoRealmenteRecibido: money(received), pendienteVigente: money(pending), interesEfectivamenteCobrado: money(interest), cantidadPrestamos: loanCount, cantidadCadenas: chains, cantidadPrestamosIndependientes: independent, saldoIncobrable: money(uncollectible), totalPrestado: money(contractual), totalPagado: money(received), pendiente: money(pending), gananciaCobrada: money(interest), ganancia: money(interest) }; }
  private mapPrestamo(p: AnalisisPrestamo, t: any, latest: AnalisisPago | undefined, ordered: AnalisisPago[], refinance: AnalisisRefinanciamiento | undefined, overdue: boolean, hoy: string) {
    const totalPagado = money(t?.monto ?? 0), capitalPagado = money(t?.capital ?? 0), interesPagado = money(t?.interes ?? 0);
    const capitalPendiente = money(Math.max(p.capital - capitalPagado, 0)), interesPendiente = money(Math.max(p.interes - interesPagado, 0));
    const saldoPendiente = money(Math.max(p.montoTotal - totalPagado, 0));
    const fechaLimiteContractual = calcularFechaLimiteContractual(p.fechaAlta, p.periodicidad, p.cantidadPagos);
    let duracionDias: number | null; let tipoDuracion: 'FINALIZADO' | 'TRANSCURRIDOS' | 'INDISPONIBLE';
    if (p.estado === EstadoPrestamo.REFINANCIADO) { duracionDias = refinance ? daysBetween(p.fechaAlta, refinance.fecha) : null; tipoDuracion = refinance ? 'FINALIZADO' : 'INDISPONIBLE'; }
    else if (p.estado === EstadoPrestamo.CANCELADO) { let capital = 0; let interes = 0; let event: string | undefined; for (const pago of ordered) { capital += pago.capitalAplicado; interes += pago.interesAplicado; if (capital >= p.capital && interes >= p.interes) { event = pago.fecha; break; } } duracionDias = daysBetween(p.fechaAlta, event ?? hoy); tipoDuracion = 'FINALIZADO'; }
    else { duracionDias = daysBetween(p.fechaAlta, hoy); tipoDuracion = 'TRANSCURRIDOS'; }
    return { id: p.id, estado: p.estado, fechaAlta: fechaDateOnly(p.fechaAlta), capital: money(p.capital), interes: money(p.interes), montoTotal: money(p.montoTotal), totalPagado, capitalPagado, interesPagado, capitalPendiente, interesPendiente, saldoPendiente, capitalTrasladadoHistorico: refinance ? money(refinance.capitalPendiente) : null, tipoSaldo: p.estado === EstadoPrestamo.REFINANCIADO ? 'TRASLADADO' : p.estado === EstadoPrestamo.ACTIVO ? 'VIGENTE' : p.estado, indicadorCobranza: p.estado === EstadoPrestamo.REFINANCIADO ? 'REFINANCIADO' : calcularIndicadorCobranza(saldoPendiente, fechaLimiteContractual, hoy, overdue), fechaLimiteContractual, ultimoPago: latest ? { fecha: latest.fecha, monto: money(latest.monto) } : null, duracionDias, tipoDuracion };
  }
}
