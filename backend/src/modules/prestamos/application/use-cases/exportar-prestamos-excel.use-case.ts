import { Inject, Injectable } from '@nestjs/common';
import { FiltrosPrestamosDto } from '../dto/filtros-prestamos.dto';
import { IndicadorCobranzaService } from '../services/indicador-cobranza.service';
import { PRESTAMO_REPOSITORY, PrestamoRepository } from '../../domain/repositories/prestamo.repository';
import { PrestamosExcelGenerator } from '../../infrastructure/reports/prestamos-excel.generator';

@Injectable()
export class ExportarPrestamosExcelUseCase {
  constructor(@Inject(PRESTAMO_REPOSITORY) private readonly repository: PrestamoRepository, private readonly cobranza: IndicadorCobranzaService, private readonly generator: PrestamosExcelGenerator) {}
  async execute(dto: FiltrosPrestamosDto) {
    const [prestamos, resumen] = await Promise.all([this.repository.listarParaExportacion(dto), this.repository.resumen(dto)]);
    return this.generator.generate(prestamos, await this.cobranza.calcular(prestamos), resumen, dto);
  }
}
