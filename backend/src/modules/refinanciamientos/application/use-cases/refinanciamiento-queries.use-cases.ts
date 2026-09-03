import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REFINANCIAMIENTO_REPOSITORY, RefinanciamientoConRelaciones, RefinanciamientoRepository } from '../../domain/repositories/refinanciamiento.repository';
import { FiltrosRefinanciamientosDto } from '../dto/filtros-refinanciamientos.dto';
@Injectable()
export class RefinanciamientoQueries {
  constructor(@Inject(REFINANCIAMIENTO_REPOSITORY) private readonly repository: RefinanciamientoRepository) {}
  listar(dto: FiltrosRefinanciamientosDto) { return this.repository.listar(dto); }
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
