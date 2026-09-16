import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/auth.decorators';
import { RolUsuario } from '../../usuarios/domain/enums/rol-usuario.enum';
import { EstadisticasClientesUseCase } from '../application/estadisticas-clientes.use-case';
import { EstadisticasClientesQueryDto } from '../application/dto/estadisticas-clientes-query.dto';
import { EstadisticasClientesResponseDto } from './dto/estadisticas-clientes-response.dto';

@ApiTags('Reportes')
@ApiBearerAuth()
@Controller('reportes')
@Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
export class EstadisticasClientesController {
  constructor(private readonly useCase: EstadisticasClientesUseCase) {}

  @Get('clientes/estadisticas')
  @ApiOperation({ summary: 'Estadísticas compactas de clientes' })
  @ApiQuery({ name: 'orden', required: false, enum: ['cantidadPrestamos', 'totalPrestado', 'gananciaCobrada'] })
  @ApiQuery({ name: 'top', required: false, enum: ['10', '20', '50', 'todos'] })
  @ApiResponse({ status: 200, type: EstadisticasClientesResponseDto })
  obtener(@Query() query: EstadisticasClientesQueryDto) { return this.useCase.execute(query); }
}
