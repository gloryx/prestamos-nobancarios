import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CierreMensualOrmEntity, ConfiguracionFinancieraOrmEntity, ConceptoDetalleCorte, DetalleCorteMensualOrmEntity } from '../domain/financial.orm-entities';
import { PrestamoOrmEntity } from '../../prestamos/infrastructure/persistence/typeorm/prestamo.orm-entity';
import { PagoOrmEntity } from '../../pagos/infrastructure/persistence/typeorm/pago.orm-entity';
import { RefinanciamientoOrmEntity } from '../../refinanciamientos/infrastructure/persistence/typeorm/refinanciamiento.orm-entity';
import { MovimientoCajaOrmEntity } from '../../movimientos-caja/infrastructure/persistence/typeorm/movimiento-caja.orm-entity';
import { EstadoPrestamo } from '../../prestamos/domain/enums/estado-prestamo.enum';
import { ConceptoMovimientoCaja } from '../../movimientos-caja/domain/enums/concepto-movimiento-caja.enum';
import { TipoMovimientoCaja } from '../../movimientos-caja/domain/enums/tipo-movimiento-caja.enum';
import { PrestamoEstadoHistorialService } from '../../prestamos/application/services/prestamo-estado-historial.service';

const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};
const monthEnd = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
const monthStart = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}-01`;
const nextMonth = (year: number, month: number): [number, number] => month === 12 ? [year + 1, 1] : [year, month + 1];
const zero = { carteraActiva: 0, carteraIncobrable: 0 };

type HistoricalLoan = { id: number; fechaAlta: string; capital: number; estado?: EstadoPrestamo };
type HistoricalPayment = { prestamoId: number; fecha: string; capitalAplicado: number };
type HistoricalRefinancing = { prestamoOrigenId: number; prestamoNuevoId: number; fecha: string };

/**
 * Reconstructs outstanding CAPITAL at a cutoff date from dated facts.
 * Loan status is intentionally not used: there is no reliable historical
 * transition timestamp for CANCELADO or INCOBRABLE. Active/incobrable buckets
 * therefore remain compatibility classifications, while the total is exact
 * for the facts currently stored.
 */
export const calculateHistoricalPortfolio = (
  loans: HistoricalLoan[],
  payments: HistoricalPayment[],
  refinanciamientos: HistoricalRefinancing[],
  fechaCorte: string,
) => {
  const existing = loans.filter(loan => loan.fechaAlta <= fechaCorte);
  const refinancedOrigins = new Set(
    refinanciamientos.filter(refin => refin.fecha <= fechaCorte).map(refin => refin.prestamoOrigenId),
  );
  const paid = new Map<number, number>();
  for (const payment of payments) {
    if (payment.fecha <= fechaCorte) paid.set(payment.prestamoId, (paid.get(payment.prestamoId) ?? 0) + payment.capitalAplicado);
  }
  return money(existing
    .filter(loan => !refinancedOrigins.has(loan.id))
    .reduce((total, loan) => total + Math.max(0, loan.capital - (paid.get(loan.id) ?? 0)), 0));
};

export const calculateExpectedPortfolio = (initial: number, originatedCapital: number, recoveredCapital: number, transferredRefinancingCapital: number) =>
  money(initial + originatedCapital - recoveredCapital - transferredRefinancingCapital);

export const calculateMonthlyResult = (interestCollected: number, netExpenses: number) =>
  money(interestCollected - netExpenses);

@Injectable()
export class FinancialPeriodService {
  constructor(@Optional() private readonly history?: PrestamoEstadoHistorialService) {}
  async config(manager: EntityManager) { return manager.getRepository(ConfiguracionFinancieraOrmEntity).findOne({ where: { singletonKey: 'FINANCIERA' } }); }
  assertDate(value: string) { if (!validDate(value)) throw new BadRequestException('La fecha debe ser válida y tener formato YYYY-MM-DD.'); }

  async assertOpen(manager: EntityManager, date: Date) {
    const value = date.toISOString().slice(0, 10); const config = await this.config(manager);
    if (config && value < config.fechaApertura) throw new BadRequestException('La fecha económica es anterior a la apertura.');
    const closed = await manager.createQueryBuilder(CierreMensualOrmEntity, 'c').where('c.fecha_inicio <= :date AND c.fecha_fin >= :date', { date: value }).getOne();
    if (closed) throw new ConflictException('El período económico está cerrado.');
  }

  private async portfolio(manager: EntityManager, at: string, initial = zero) {
    const loans = await manager.getRepository(PrestamoOrmEntity).createQueryBuilder('p').where('p.fecha_alta <= :at', { at }).getMany();
    const refinanciamientos = await manager.getRepository(RefinanciamientoOrmEntity).createQueryBuilder('r').where('r.fecha <= :at', { at }).getMany();
    const ids = loans.map(p => p.id);
    const payments = ids.length ? await manager.getRepository(PagoOrmEntity).createQueryBuilder('p').where('p.prestamo_id IN (:...ids)', { ids }).andWhere('p.estado = :state', { state: 'REGISTRADO' }).andWhere('p.fecha <= :at', { at }).getMany() : [];
    const paid = new Map<number, number>(); for (const p of payments) paid.set(p.prestamoId, (paid.get(p.prestamoId) ?? 0) + p.capitalAplicado);
    const states = new Map<number, string>();
    if (this.history) for (const loan of loans) states.set(loan.id, await this.history.estadoDelPrestamoEnFecha(manager, loan.id, new Date(`${at}T00:00:00.000Z`)));
    // Legacy loans without a transition are explicitly unknown and are omitted
    // from state buckets; the total remains reconstructed from dated facts.
    const bucket = (state: EstadoPrestamo) => money((this.history ? loans.filter(p => states.get(p.id) === state) : loans.filter(p => p.estado === state)).reduce((sum, p) => sum + Math.max(0, p.capital - (paid.get(p.id) ?? 0)), 0));
    const carteraActiva = bucket(EstadoPrestamo.ACTIVO); const carteraIncobrable = bucket(EstadoPrestamo.INCOBRABLE);
    const carteraTotal = calculateHistoricalPortfolio(loans, payments, refinanciamientos, at);
    return { carteraActiva, carteraIncobrable, carteraTotal, initial };
  }

  private async flows(manager: EntityManager, from: string, to: string, disponibleInicial: number) {
    const payments = await manager.getRepository(PagoOrmEntity).createQueryBuilder('p').where('p.estado = :state', { state: 'REGISTRADO' }).andWhere('p.fecha BETWEEN :from AND :to', { from, to }).getMany();
    const capital = money(payments.reduce((s, p) => s + p.capitalAplicado, 0)); const interest = money(payments.reduce((s, p) => s + p.interesAplicado, 0));
    const paymentMismatch = payments.some(p => money(p.monto) !== money(p.capitalAplicado + p.interesAplicado));
    const movements = await manager.getRepository(MovimientoCajaOrmEntity).createQueryBuilder('m').leftJoinAndSelect('m.movimientoReversado', 'original').where('m.fecha BETWEEN :from AND :to', { from, to }).getMany();
    let entradas = 0; let salidas = 0; const indicators = new Map<string, number>();
    const add = (key: string, value: number) => indicators.set(key, money((indicators.get(key) ?? 0) + value));
    for (const m of movements) {
      if (m.tipo === TipoMovimientoCaja.ENTRADA) entradas += m.monto; else salidas += m.monto;
      const originalConcept = m.concepto === ConceptoMovimientoCaja.REVERSO ? m.movimientoReversado?.concepto : m.concepto;
      const sign = m.concepto === ConceptoMovimientoCaja.REVERSO ? -1 : 1;
      const map: Record<string, string> = { APORTE_CAPITAL: 'APORTES_CAPITAL', RETIRO: 'RETIROS', GASTO: 'GASTOS', AJUSTE_ENTRADA: 'AJUSTES_ENTRADA', AJUSTE_SALIDA: 'AJUSTES_SALIDA' };
      if (originalConcept && map[originalConcept]) add(map[originalConcept], sign * m.monto);
    }
    const refin = await manager.getRepository(RefinanciamientoOrmEntity).createQueryBuilder('r').where('r.fecha BETWEEN :from AND :to', { from, to }).getMany();
    const loanOut = movements.filter(m => m.concepto === ConceptoMovimientoCaja.DESEMBOLSO_PRESTAMO).reduce((s, m) => s + m.monto, 0);
    const refinanceOut = movements.filter(m => m.concepto === ConceptoMovimientoCaja.DESEMBOLSO_REFINANCIAMIENTO).reduce((s, m) => s + m.monto, 0);
    const values = { disponibleInicial, entradas: money(entradas), salidas: money(salidas), capital, interest, paymentMismatch, loanOut: money(loanOut), refinanceOut: money(refinanceOut), refinanced: money(refin.reduce((s, r) => s + r.montoRefinanciado, 0)), indicators };
    return values;
  }

  async calculate(manager: EntityManager, from: string, to: string, initial?: { carteraInicial: number; carteraActivaInicial: number; carteraIncobrableInicial: number; disponibleInicial: number }) {
    const config = await this.config(manager); const prior = initial ?? { carteraInicial: 0, carteraActivaInicial: 0, carteraIncobrableInicial: 0, disponibleInicial: config?.disponibleInicial ?? 0 };
    const portfolio = await this.portfolio(manager, to, { carteraActiva: prior.carteraActivaInicial, carteraIncobrable: prior.carteraIncobrableInicial });
    const flows = await this.flows(manager, from, to, prior.disponibleInicial);
    const disponibleFinal = money(flows.disponibleInicial + flows.entradas - flows.salidas);
    const pagosRecibidos = money(flows.capital + flows.interest); const errors: string[] = [];
    if (money(pagosRecibidos) !== money(flows.capital + flows.interest)) errors.push('PAGOS_RECIBIDOS debe ser CAPITAL_RECUPERADO + INTERESES_COBRADOS.');
    if (flows.paymentMismatch) errors.push('PAGOS_RECIBIDOS no coincide con CAPITAL_RECUPERADO + INTERESES_COBRADOS en uno o más pagos.');
    const newLoans = await manager.getRepository(PrestamoOrmEntity).createQueryBuilder('p').where('p.fecha_alta BETWEEN :from AND :to', { from, to }).getMany();
    const refinanciamientos = await manager.getRepository(RefinanciamientoOrmEntity).createQueryBuilder('r').where('r.fecha BETWEEN :from AND :to', { from, to }).getMany();
    const originatedCapital = newLoans.reduce((s, p) => s + p.capital, 0);
    const transferredRefinancingCapital = refinanciamientos.reduce((s, r) => s + r.capitalPendiente, 0);
    const expectedPortfolio = calculateExpectedPortfolio(prior.carteraInicial, originatedCapital, flows.capital, transferredRefinancingCapital);
    if (expectedPortfolio !== portfolio.carteraTotal) errors.push(`Control de cartera inconsistente: esperado ${expectedPortfolio}, final ${portfolio.carteraTotal}.`);
    const details: Record<ConceptoDetalleCorte, number> = {
      [ConceptoDetalleCorte.CARTERA_INICIAL]: prior.carteraInicial, [ConceptoDetalleCorte.CARTERA_ACTIVA_INICIAL]: prior.carteraActivaInicial, [ConceptoDetalleCorte.CARTERA_INCOBRABLE_INICIAL]: prior.carteraIncobrableInicial,
      [ConceptoDetalleCorte.CARTERA_ACTIVA_FINAL]: portfolio.carteraActiva, [ConceptoDetalleCorte.CARTERA_INCOBRABLE_FINAL]: portfolio.carteraIncobrable, [ConceptoDetalleCorte.CARTERA_TOTAL_FINAL]: portfolio.carteraTotal,
      [ConceptoDetalleCorte.DISPONIBLE_INICIAL]: flows.disponibleInicial, [ConceptoDetalleCorte.DISPONIBLE_FINAL]: disponibleFinal, [ConceptoDetalleCorte.PAGOS_RECIBIDOS]: pagosRecibidos, [ConceptoDetalleCorte.CAPITAL_RECUPERADO]: flows.capital, [ConceptoDetalleCorte.INTERESES_COBRADOS]: flows.interest,
      [ConceptoDetalleCorte.DESEMBOLSOS_PRESTAMOS]: flows.loanOut, [ConceptoDetalleCorte.DESEMBOLSOS_REFINANCIAMIENTOS]: flows.refinanceOut, [ConceptoDetalleCorte.MONTO_REFINANCIADO]: flows.refinanced,
      [ConceptoDetalleCorte.APORTES_CAPITAL]: flows.indicators.get('APORTES_CAPITAL') ?? 0, [ConceptoDetalleCorte.RETIROS]: flows.indicators.get('RETIROS') ?? 0, [ConceptoDetalleCorte.GASTOS]: flows.indicators.get('GASTOS') ?? 0, [ConceptoDetalleCorte.AJUSTES_ENTRADA]: flows.indicators.get('AJUSTES_ENTRADA') ?? 0, [ConceptoDetalleCorte.AJUSTES_SALIDA]: flows.indicators.get('AJUSTES_SALIDA') ?? 0,
      [ConceptoDetalleCorte.ENTRADAS_CAJA]: flows.entradas, [ConceptoDetalleCorte.SALIDAS_CAJA]: flows.salidas, [ConceptoDetalleCorte.RESULTADO_MES]: calculateMonthlyResult(flows.interest, flows.indicators.get('GASTOS') ?? 0),
    };
    return { fechaInicio: from, fechaFin: to, carteraActiva: portfolio.carteraActiva, carteraIncobrable: portfolio.carteraIncobrable, carteraTotal: portfolio.carteraTotal, pagosRecibidos, pagosCapital: flows.capital, pagosInteres: flows.interest, disponibleInicial: flows.disponibleInicial, disponibleFinal, cajaEntradas: flows.entradas, cajaSalidas: flows.salidas, errors, canClose: errors.length === 0, detalles: Object.entries(details).map(([concepto, monto]) => ({ concepto, monto: money(monto) })) };
  }

  async openingSnapshot(manager: EntityManager, fecha: string) { this.assertDate(fecha); const p = await this.portfolio(manager, fecha); return { fechaApertura: fecha, carteraTotal: p.carteraTotal, carteraActiva: p.carteraActiva, carteraIncobrable: p.carteraIncobrable }; }
  private async period(manager: EntityManager, year: number, month: number) {
    if (!Number.isInteger(year) || year < 1 || !Number.isInteger(month) || month < 1 || month > 12) throw new BadRequestException('El período mensual no es válido.');
    const config = await this.config(manager); if (!config) throw new NotFoundException('Configuración financiera no encontrada.');
    const first = monthStart(year, month); const from = first < config.fechaApertura ? config.fechaApertura : first; const to = monthEnd(year, month); if (from > to) throw new BadRequestException('El período es anterior a la apertura financiera.');
    const last = await manager.getRepository(CierreMensualOrmEntity).createQueryBuilder('c').orderBy('c.fecha_fin', 'DESC').getOne(); const expected: [number, number] = last ? nextMonth(last.anio, last.mes) : [Number(config.fechaApertura.slice(0, 4)), Number(config.fechaApertura.slice(5, 7))];
    if (year !== expected[0] || month !== expected[1]) throw new ConflictException('Los cierres deben respetar la secuencia mensual sin saltos.');
    const initial = last ? await manager.getRepository(DetalleCorteMensualOrmEntity).find({ where: { corteId: last.id } }) : [];
    const value = (concepto: ConceptoDetalleCorte, fallback: number) => initial.find(d => d.concepto === concepto)?.monto ?? fallback;
    return { config, from, to, initial: { carteraInicial: value(ConceptoDetalleCorte.CARTERA_TOTAL_FINAL, config.carteraInicial), carteraActivaInicial: value(ConceptoDetalleCorte.CARTERA_ACTIVA_FINAL, config.carteraActivaInicial), carteraIncobrableInicial: value(ConceptoDetalleCorte.CARTERA_INCOBRABLE_FINAL, config.carteraIncobrableInicial), disponibleInicial: value(ConceptoDetalleCorte.DISPONIBLE_FINAL, config.disponibleInicial) } };
  }
  async previewClose(manager: EntityManager, year: number, month: number) { const p = await this.period(manager, year, month); return this.calculate(manager, p.from, p.to, p.initial); }
  async close(manager: EntityManager, year: number, month: number, userId: number, observaciones?: string | null) {
    const config = await manager.getRepository(ConfiguracionFinancieraOrmEntity).createQueryBuilder('c').where('c.singleton_key = :key', { key: 'FINANCIERA' }).setLock('pessimistic_write').getOne(); if (!config) throw new NotFoundException('Configuración financiera no encontrada.');
    const p = await this.period(manager, year, month); const snapshot = await this.calculate(manager, p.from, p.to, p.initial); if (!snapshot.canClose) throw new BadRequestException(snapshot.errors);
    try { const close = await manager.getRepository(CierreMensualOrmEntity).save({ anio: year, mes: month, fechaInicio: snapshot.fechaInicio, fechaFin: snapshot.fechaFin, fechaCierre: new Date(), usuarioCierreId: userId, observaciones: observaciones?.trim() || null }); await manager.getRepository(DetalleCorteMensualOrmEntity).insert(snapshot.detalles.map(d => ({ corteId: close.id, concepto: d.concepto as ConceptoDetalleCorte, monto: d.monto }))); return { ...close, detalles: snapshot.detalles }; } catch (error) { if ((error as any)?.code === '23505') throw new ConflictException('El período ya fue cerrado concurrentemente.'); throw error; }
  }
}
