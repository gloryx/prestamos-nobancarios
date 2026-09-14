import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AnulacionesPaginadas, PRESTAMO_REPOSITORY, PrestamoRepository, PrestamosPaginados } from '../../domain/repositories/prestamo.repository';
import { FiltrosPrestamosDto } from '../dto/filtros-prestamos.dto';
import { IndicadorCobranzaService } from '../services/indicador-cobranza.service';
import { PrestamoAnulacionService } from '../services/prestamo-anulacion.service';
@Injectable()
export class ListarPrestamosUseCase {
  constructor(@Inject(PRESTAMO_REPOSITORY) private readonly repository: PrestamoRepository, private readonly cobranza: IndicadorCobranzaService, @Optional() private readonly anulacion?: PrestamoAnulacionService, @Optional() @InjectDataSource() private readonly dataSource?: DataSource) {}

  async execute(dto: FiltrosPrestamosDto): Promise<PrestamosPaginados> {
    if (!dto.indicadorCobranza && dto.ordenarPor !== 'indicadorCobranza') {
      const result = await this.repository.listar(dto);
      if (!this.anulacion || !this.dataSource) return result;
      const flags = await this.anulacion.calcular(this.dataSource.manager, result.datos.map((loan) => loan.id!));
      return { ...result, datos: result.datos.map((loan) => Object.assign(loan, { puedeAnular: flags.get(loan.id!)?.puedeAnular ?? false })) };
    }
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
    const result = await this.repository.listar({ ...dto, candidateIds });
    if (!this.anulacion || !this.dataSource) return result;
    const flags = await this.anulacion.calcular(this.dataSource.manager, result.datos.map((loan) => loan.id!));
    return { ...result, datos: result.datos.map((loan) => Object.assign(loan, { puedeAnular: flags.get(loan.id!)?.puedeAnular ?? false })) };
  }

  listarCandidatosAnulacion(dto: FiltrosPrestamosDto): Promise<PrestamosPaginados> { return this.repository.listarCandidatosAnulacion(dto); }
  listarAnulados(dto: FiltrosPrestamosDto): Promise<AnulacionesPaginadas> { return this.repository.listarAnulados(dto); }
}
