import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/auth.decorators';
import { RolUsuario } from '../../usuarios/domain/enums/rol-usuario.enum';
import { DesempenoCobradoresUseCase } from '../application/desempeno-cobradores.use-case';
import { DesempenoCobradoresQueryDto } from '../application/dto/desempeno-cobradores-query.dto';
import { DesempenoCobradoresResponseDto } from './dto/desempeno-cobradores-response.dto';
import { ExportarDesempenoCobradoresPdfUseCase } from '../application/exportar-desempeno-cobradores-pdf.use-case';

@ApiTags('Reportes')
@ApiBearerAuth()
@Controller('reportes')
@Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
export class DesempenoCobradoresController {
  constructor(private readonly useCase: DesempenoCobradoresUseCase, private readonly exportPdf: ExportarDesempenoCobradoresPdfUseCase) {}

  @Get('desempeno-cobradores')
  @ApiOperation({ summary: 'Desempeño descriptivo de cobradores', description: 'Agrega exclusivamente pagos REGISTRADO por fecha de pago, sin paginación.' })
  @ApiQuery({ name: 'fechaDesde', required: true, type: String, example: '2026-09-01' })
  @ApiQuery({ name: 'fechaHasta', required: true, type: String, example: '2026-09-30' })
  @ApiQuery({ name: 'cobradorId', required: false, type: Number })
  @ApiQuery({ name: 'formaPagoId', required: false, type: Number })
  @ApiResponse({ status: 200, type: DesempenoCobradoresResponseDto })
  obtener(@Query() query: DesempenoCobradoresQueryDto) { return this.useCase.execute(query); }

  @Get('desempeno-cobradores/exportar/pdf')
  @ApiOperation({ summary: 'Exportar desempeño de cobradores a PDF', description: 'Exporta el mismo conjunto completo filtrado y las mismas métricas descriptivas del reporte de desempeño de cobradores, sin paginación ni pagos individuales.' })
  @ApiQuery({ name: 'fechaDesde', required: true, type: String, example: '2026-09-01' })
  @ApiQuery({ name: 'fechaHasta', required: true, type: String, example: '2026-09-30' })
  @ApiQuery({ name: 'cobradorId', required: false, type: Number })
  @ApiQuery({ name: 'formaPagoId', required: false, type: Number })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'PDF A4 horizontal del desempeño filtrado.', content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } })
  async exportarPdf(@Query() query: DesempenoCobradoresQueryDto, @Res() response: Response): Promise<void> {
    const pdf = await this.exportPdf.execute(query);
    const filename = `desempeno-cobradores-${query.fechaDesde}-${query.fechaHasta}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '-');
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response.send(pdf);
  }
}
