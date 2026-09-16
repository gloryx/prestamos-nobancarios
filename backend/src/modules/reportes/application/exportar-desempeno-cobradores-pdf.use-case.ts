import { Injectable } from '@nestjs/common';
import { DesempenoCobradoresUseCase } from './desempeno-cobradores.use-case';
import type { DesempenoCobradoresQueryDto } from './dto/desempeno-cobradores-query.dto';
import { DesempenoCobradoresPdfService } from '../infrastructure/desempeno-cobradores-pdf.service';

@Injectable()
export class ExportarDesempenoCobradoresPdfUseCase {
  constructor(private readonly reporte: DesempenoCobradoresUseCase, private readonly pdf: DesempenoCobradoresPdfService) {}

  async execute(query: DesempenoCobradoresQueryDto): Promise<Buffer> {
    const report = await this.reporte.execute(query);
    return this.pdf.generar(report, query);
  }
}
