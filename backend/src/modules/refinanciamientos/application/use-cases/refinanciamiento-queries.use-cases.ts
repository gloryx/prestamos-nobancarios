import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REFINANCIAMIENTO_REPOSITORY, RefinanciamientoConRelaciones, RefinanciamientoRepository } from '../../domain/repositories/refinanciamiento.repository';
import { FiltrosRefinanciamientosDto } from '../dto/filtros-refinanciamientos.dto';
import { FiltrosRefinanciamientosReporteDto } from '../dto/filtros-refinanciamientos-reporte.dto';
import { calcularDiasGanados } from '../services/calcular-dias-ganados';

const cents = (value: number): number => Math.round(Number(value || 0) * 100);
const money = (value: number): number => cents(value) / 100;
const moneyFromCents = (value: number): number => value / 100;
@Injectable()
export class RefinanciamientoQueries {
  constructor(@Inject(REFINANCIAMIENTO_REPOSITORY) private readonly repository: RefinanciamientoRepository) {}
  listar(dto: FiltrosRefinanciamientosDto) { return this.repository.listar(dto); }
  async reporte(dto: FiltrosRefinanciamientosReporteDto) {
    const filters = { buscar: dto.buscar?.trim() || undefined, clienteId: dto.clienteId, fechaDesde: dto.fechaDesde, fechaHasta: dto.fechaHasta };
    const values = await this.repository.listarReporte(filters);
    const datos = values.map((value) => ({
      id: value.id!, fecha: value.fecha.toISOString().slice(0, 10), cliente: value.cliente!, prestamoOrigenId: value.prestamoOrigenId,
      capitalTrasladado: money(value.capitalPendiente), dineroNuevoDesembolsado: money(value.prestamoNuevo?.montoDesembolsado ?? 0),
      capitalNuevo: money(value.prestamoNuevo?.capital ?? 0), interesNuevo: money(value.interesNuevo),
      diasGanados: calcularDiasGanados(value.fechaLimiteContractualOrigen, value.fecha), prestamoNuevoId: value.prestamoNuevoId,
    }));
    const knownDays = datos.map((value) => value.diasGanados).filter((value): value is number => value !== null);
    const totalCapital = values.reduce((sum, value) => sum + cents(value.capitalPendiente), 0);
    const totalDinero = values.reduce((sum, value) => sum + cents(value.prestamoNuevo?.montoDesembolsado ?? 0), 0);
    const totalCapitalNuevo = values.reduce((sum, value) => sum + cents(value.prestamoNuevo?.capital ?? 0), 0);
    const totalInteres = values.reduce((sum, value) => sum + cents(value.interesNuevo), 0);
    const clientes = new Set(values.map((value) => value.cliente?.id).filter((id): id is number => id !== undefined));
    return {
      filtros: { buscar: filters.buscar ?? null, clienteId: filters.clienteId ?? null, fechaDesde: filters.fechaDesde ?? null, fechaHasta: filters.fechaHasta ?? null },
      resumen: {
        cantidadRefinanciamientos: values.length, cantidadClientes: clientes.size, totalCapitalTrasladado: moneyFromCents(totalCapital),
        totalDineroNuevoDesembolsado: moneyFromCents(totalDinero), totalCapitalNuevo: moneyFromCents(totalCapitalNuevo), totalInteresNuevoPactado: moneyFromCents(totalInteres),
        refinanciamientosConDineroNuevo: datos.filter((value) => value.dineroNuevoDesembolsado > 0).length,
        refinanciamientosSinDineroNuevo: datos.filter((value) => value.dineroNuevoDesembolsado === 0).length,
        refinanciamientosAnticipados: knownDays.filter((value) => value > 0).length,
        refinanciamientosSinAnticipacion: knownDays.filter((value) => value === 0).length,
        promedioDiasGanados: knownDays.length ? Math.round(knownDays.reduce((sum, value) => sum + value, 0) / knownDays.length) : null,
        diasGanadosCompletos: knownDays.length === datos.length,
      }, datos,
    };
  }
  async detalle(id: number) { const value = await this.repository.buscarPorId(id); if (!value) throw new NotFoundException('Refinanciamiento no encontrado.'); return value; }
   async origen(prestamoId: number) { const value = await this.repository.buscarPorPrestamoOrigenId(prestamoId); if (!value) throw new NotFoundException('Refinanciamiento no encontrado.'); return value; }
   async nuevo(prestamoId: number) { const value = await this.repository.buscarPorPrestamoNuevoId(prestamoId); if (!value) throw new NotFoundException('Refinanciamiento no encontrado.'); return value; }
  async cadena(prestamoId: number): Promise<RefinanciamientoConRelaciones[]> {
    const result: RefinanciamientoConRelaciones[] = [];
    const seenRelations = new Set<number>();
    const visitedLoans = new Set<number>([prestamoId]);

    let currentLoanId = prestamoId;
    while (true) {
      const relation = await this.repository.buscarPorPrestamoNuevoId(currentLoanId);
      if (!relation || seenRelations.has(relation.id!)) break;
      seenRelations.add(relation.id!);
      result.unshift(relation);
      if (visitedLoans.has(relation.prestamoOrigenId)) break;
      visitedLoans.add(relation.prestamoOrigenId);
      currentLoanId = relation.prestamoOrigenId;
    }

    currentLoanId = prestamoId;
    while (true) {
      const relation = await this.repository.buscarPorPrestamoOrigenId(currentLoanId);
      if (!relation || seenRelations.has(relation.id!)) break;
      seenRelations.add(relation.id!);
      result.push(relation);
      if (visitedLoans.has(relation.prestamoNuevoId)) break;
      visitedLoans.add(relation.prestamoNuevoId);
      currentLoanId = relation.prestamoNuevoId;
    }

    if (!result.length) throw new NotFoundException('Refinanciamiento no encontrado.');
    return result;
  }
}
