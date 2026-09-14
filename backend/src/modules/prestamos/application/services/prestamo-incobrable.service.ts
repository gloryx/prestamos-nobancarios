import { Inject, Injectable } from '@nestjs/common';
import { FiltrosIncobrablesDto } from '../dto/filtros-incobrables.dto';
import { IncobrablesPaginados, PRESTAMO_REPOSITORY, PrestamoRepository } from '../../domain/repositories/prestamo.repository';
import { EntityManager } from 'typeorm';

/** Central policy boundary. Controllers and state transitions use the same persisted-plan rule. */
@Injectable()
export class PrestamoIncobrableService {
  constructor(@Inject(PRESTAMO_REPOSITORY) private readonly repository: PrestamoRepository) {}

  listarCandidatos(filtros: FiltrosIncobrablesDto): Promise<IncobrablesPaginados> { return this.repository.listarCandidatosIncobrables(filtros); }
  listarIncobrables(filtros: FiltrosIncobrablesDto): Promise<IncobrablesPaginados> { return this.repository.listarIncobrables(filtros); }
  esElegible(id: number, fechaReferencia: string, manager?: EntityManager): Promise<boolean> { return this.repository.esElegibleParaIncobrable(id, fechaReferencia, manager); }
}
