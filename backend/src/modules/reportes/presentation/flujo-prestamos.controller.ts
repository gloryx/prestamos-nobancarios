import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/auth.decorators';
import { RolUsuario } from '../../usuarios/domain/enums/rol-usuario.enum';
import { FlujoPrestamosUseCase } from '../application/flujo-prestamos.use-case';
import { FlujoPrestamosQueryDto } from '../application/dto/flujo-prestamos-query.dto';
import { FlujoPrestamosResponseDto } from './dto/flujo-prestamos-response.dto';

@ApiTags('Reportes') @ApiBearerAuth() @Controller('reportes') @Roles(RolUsuario.ADMINISTRADOR)
export class FlujoPrestamosController { constructor(private readonly flujo: FlujoPrestamosUseCase) {} @Get('flujo-prestamos') @ApiOperation({ summary: 'Flujo histórico de préstamos', description: 'Agrega desembolsos reales y pagos por mes. Pagos recibidos menos dinero nuevo desembolsado. No representa utilidad.' }) @ApiQuery({ name: 'desde', required: true, example: '2025-01' }) @ApiQuery({ name: 'hasta', required: true, example: '2025-12' }) @ApiResponse({ status: 200, type: FlujoPrestamosResponseDto }) async obtener(@Query() query: FlujoPrestamosQueryDto) { return this.flujo.execute(query); } }
