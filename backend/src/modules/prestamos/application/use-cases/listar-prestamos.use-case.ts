import { Inject, Injectable } from '@nestjs/common';
import { PRESTAMO_REPOSITORY, PrestamoRepository, PrestamosPaginados } from '../../domain/repositories/prestamo.repository';
import { FiltrosPrestamosDto } from '../dto/filtros-prestamos.dto';
import { IndicadorCobranzaService } from '../services/indicador-cobranza.service';
@Injectable()
export class ListarPrestamosUseCase {
  constructor(@Inject(PRESTAMO_REPOSITORY) private readonly repository: PrestamoRepository, private readonly cobranza: IndicadorCobranzaService) {}

  async execute(dto: FiltrosPrestamosDto): Promise<PrestamosPaginados> {
    if (!dto.indicadorCobranza) return this.repository.listar(dto);
    const candidates = await this.repository.listarParaIndicador(dto);
    const indicators = await this.cobranza.calcular(candidates);
    const candidateIds = candidates.filter((prestamo) => indicators.get(prestamo.id!)?.indicadorCobranza === dto.indicadorCobranza).map((prestamo) => prestamo.id!);
    return this.repository.listar({ ...dto, candidateIds });
  }
}
