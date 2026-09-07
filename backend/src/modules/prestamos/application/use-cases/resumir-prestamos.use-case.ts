import { Inject, Injectable } from '@nestjs/common';
import { FiltrosPrestamosDto } from '../dto/filtros-prestamos.dto';
import { PRESTAMO_REPOSITORY, PrestamoRepository, PrestamosResumen } from '../../domain/repositories/prestamo.repository';

@Injectable()
export class ResumirPrestamosUseCase {
  constructor(@Inject(PRESTAMO_REPOSITORY) private readonly repository: PrestamoRepository) {}

  execute(dto: FiltrosPrestamosDto): Promise<PrestamosResumen> {
    return this.repository.resumen(dto);
  }
}
