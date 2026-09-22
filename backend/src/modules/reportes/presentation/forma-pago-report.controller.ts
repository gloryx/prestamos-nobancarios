import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/auth.decorators';
import { RolUsuario } from '../../usuarios/domain/enums/rol-usuario.enum';
import { FormaPagoReportUseCase } from '../application/forma-pago-report.use-case';
import { FormaPagoReportQueryDto } from '../application/dto/forma-pago-report-query.dto';
import { FormaPagoReportResponseDto } from './dto/forma-pago-report-response.dto';

@ApiTags('Reportes') @ApiBearerAuth() @Controller('reportes') @Roles(RolUsuario.ADMINISTRADOR)
export class FormaPagoReportController {
  constructor(private readonly report: FormaPagoReportUseCase) {}
  @Get('forma-pago') @ApiOperation({ summary: 'Reporte por forma de pago', description: 'Agrupa desembolsos reales de Caja y pagos registrados por forma de pago. Las formas históricas inactivas se conservan cuando tienen movimientos.' }) @ApiQuery({ name: 'fechaDesde', required: true, example: '2026-01-01' }) @ApiQuery({ name: 'fechaHasta', required: true, example: '2026-01-31' }) @ApiResponse({ status: 200, type: FormaPagoReportResponseDto }) obtener(@Query() query: FormaPagoReportQueryDto) { return this.report.execute(query); }
}
