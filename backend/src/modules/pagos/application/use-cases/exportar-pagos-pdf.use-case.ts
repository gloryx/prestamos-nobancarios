import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { FiltrosPagos, PAGO_REPOSITORY, PagoRepository } from '../../domain/repositories/pago.repository';
import { FiltrosPagosDto } from '../dto/filtros-pagos.dto';
import { PagosPdfService } from '../../infrastructure/pdf/pagos-pdf.service';

@Injectable()
export class ExportarPagosPdfUseCase {
  constructor(
    @Inject(PAGO_REPOSITORY) private readonly pagos: PagoRepository,
    private readonly pdf: PagosPdfService,
  ) {}

  async execute(dto: FiltrosPagosDto): Promise<Buffer> {
    if (dto.fechaDesde && dto.fechaHasta && dto.fechaDesde > dto.fechaHasta) {
      throw new BadRequestException('fechaDesde no puede ser posterior a fechaHasta.');
    }
    const result = await this.pagos.listarParaExportacion(dto as FiltrosPagos);
    return this.pdf.generar(result, dto);
  }
}
