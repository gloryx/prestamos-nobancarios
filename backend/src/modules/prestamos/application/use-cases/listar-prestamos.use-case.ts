import { Inject, Injectable } from '@nestjs/common';
import { PRESTAMO_REPOSITORY, PrestamoRepository, PrestamosPaginados } from '../../domain/repositories/prestamo.repository';
import { FiltrosPrestamosDto } from '../dto/filtros-prestamos.dto';
import { IndicadorCobranzaService } from '../services/indicador-cobranza.service';
@Injectable()
export class ListarPrestamosUseCase {
  constructor(@Inject(PRESTAMO_REPOSITORY) private readonly repository: PrestamoRepository, private readonly cobranza: IndicadorCobranzaService) {}

  async execute(dto: FiltrosPrestamosDto): Promise<PrestamosPaginados> {
    if (!dto.indicadorCobranza && dto.ordenarPor !== 'indicadorCobranza') return this.repository.listar(dto);
    const candidates = await this.repository.listarParaIndicador(dto);
    const indicators = await this.cobranza.calcular(candidates);
    const filtered = dto.indicadorCobranza
      ? candidates.filter((prestamo) => indicators.get(prestamo.id!)?.indicadorCobranza === dto.indicadorCobranza)
      : candidates;
    const priority: Record<string, number> = { AL_DIA: 1, ATRASADO: 2, PLAZO_CUMPLIDO: 3, SALDADO: 4 };
    const direction = dto.direccionOrden === 'DESC' ? -1 : 1;
    const candidateIds = filtered
      .sort((a, b) => dto.ordenarPor !== 'indicadorCobranza' ? 0 : direction * ((priority[indicators.get(a.id!)?.indicadorCobranza ?? ''] - priority[indicators.get(b.id!)?.indicadorCobranza ?? '']) || (a.id! - b.id!)))
      .map((prestamo) => prestamo.id!);
    return this.repository.listar({ ...dto, candidateIds });
  }
}
