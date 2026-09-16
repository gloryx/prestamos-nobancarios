import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/auth.decorators';
import { RolUsuario } from '../../usuarios/domain/enums/rol-usuario.enum';
import { AnalisisFinancieroUseCase } from '../application/analisis-financiero.use-case';
import { AnalisisFinancieroAnioQueryDto, AnalisisFinancieroComparativoQueryDto, ProyeccionQueryDto } from '../application/dto/analisis-financiero-query.dto';
import { ComparativoAnualResponseDto, ResumenMensualResponseDto } from './dto/analisis-financiero-response.dto';
import { ProyeccionResponseDto } from './dto/proyeccion-response.dto';

@ApiTags('Análisis financiero')
@ApiBearerAuth()
@Controller('analisis-financiero')
@Roles(RolUsuario.ADMINISTRADOR)
export class AnalisisFinancieroController {
  constructor(private readonly useCase: AnalisisFinancieroUseCase) {}

  @Get('resumen-mensual')
  @ApiOperation({ summary: 'Resumen financiero mensual', description: 'Siempre devuelve los 12 meses. ganancia significa interés efectivamente cobrado, no interés contractual.' })
  @ApiQuery({ name: 'anio', required: true, example: 2026, type: Number })
  @ApiResponse({ status: 200, type: ResumenMensualResponseDto })
  resumenMensual(@Query() query: AnalisisFinancieroAnioQueryDto) { return this.useCase.resumenMensual(Number(query.anio)); }

  @Get('comparativo-anual')
  @ApiOperation({ summary: 'Comparativo financiero anual', description: 'Incluye todos los años del rango, incluso los que no tienen movimientos. ganancia significa interés efectivamente cobrado.' })
  @ApiQuery({ name: 'desde', required: true, example: 2026, type: Number })
  @ApiQuery({ name: 'hasta', required: true, example: 2030, type: Number })
  @ApiResponse({ status: 200, type: ComparativoAnualResponseDto })
  comparativoAnual(@Query() query: AnalisisFinancieroComparativoQueryDto) { return this.useCase.comparativoAnual(Number(query.desde), Number(query.hasta)); }

  @Get('proyeccion')
  @ApiOperation({ summary: 'Proyección contractual de ganancias', description: 'Distribuye el interés pendiente proporcionalmente al saldo de las cuotas del plan operativo vigente dentro del horizonte inclusivo de fechas UTC.' })
  @ApiQuery({ name: 'periodo', required: false, enum: ['15d', '1m', '2m', '3m', 'cartera'], example: '1m' })
  @ApiResponse({ status: 200, type: ProyeccionResponseDto })
  proyeccion(@Query() query: ProyeccionQueryDto) { return this.useCase.proyeccion(query.periodo); }
}
