import { Inject, Injectable } from '@nestjs/common';
import { PRESTAMO_REPOSITORY, PrestamoRepository, PrestamosPaginados } from '../../domain/repositories/prestamo.repository';
import { FiltrosPrestamosDto } from '../dto/filtros-prestamos.dto';
@Injectable()
export class ListarPrestamosUseCase { constructor(@Inject(PRESTAMO_REPOSITORY) private readonly repository: PrestamoRepository) {} execute(dto: FiltrosPrestamosDto): Promise<PrestamosPaginados> { return this.repository.listar(dto); } }
