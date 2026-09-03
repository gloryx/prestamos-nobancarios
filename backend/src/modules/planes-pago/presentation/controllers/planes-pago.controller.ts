import { Body, Controller, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrearPlanPagoPersonalizadoUseCase } from '../../application/use-cases/crear-plan-pago-personalizado.use-case';
import { GenerarPlanPagoUseCase } from '../../application/use-cases/generar-plan-pago.use-case';
import { ListarPlanPagoUseCase } from '../../application/use-cases/listar-plan-pago.use-case';
import { ObtenerCuotaPlanPagoUseCase } from '../../application/use-cases/obtener-cuota-plan-pago.use-case';
import { ActualizarPlanPagoUseCase } from '../../application/use-cases/actualizar-plan-pago.use-case';
import { PlanPagoPersonalizadoDto } from '../../application/dto/plan-pago-personalizado.dto';
import { PlanPago } from '../../domain/entities/plan-pago';
import { PlanPagoResponseDto } from '../dto/plan-pago-response.dto';
import { Roles } from '../../../auth/auth.decorators';
import { RolUsuario } from '../../../usuarios/domain/enums/rol-usuario.enum';

const response = (plan: PlanPago): PlanPagoResponseDto => ({ id: plan.id!, prestamoId: plan.prestamoId, numeroPago: plan.numeroPago, fechaVencimiento: plan.fechaVencimiento.toISOString().slice(0, 10), montoProgramado: plan.montoProgramado, fechaCreacion: plan.fechaCreacion });
const responses = (plans: PlanPago[]) => plans.map(response);

@ApiTags('Planes de pago')
@ApiBearerAuth()
@Controller('planes-pago')
export class PlanesPagoController {
  constructor(private readonly generar: GenerarPlanPagoUseCase, private readonly personalizado: CrearPlanPagoPersonalizadoUseCase, private readonly listar: ListarPlanPagoUseCase, private readonly obtener: ObtenerCuotaPlanPagoUseCase, private readonly actualizar: ActualizarPlanPagoUseCase) {}
  @Post('prestamo/:prestamoId/generar') @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR) @ApiOperation({ summary: 'Generar plan automático', description: 'Genera cuotas con periodicidad semanal, diaria, quincenal o mensual.' }) @ApiParam({ name: 'prestamoId', example: 10 }) @ApiResponse({ status: 201, type: [PlanPagoResponseDto] })
  async generarPlan(@Param('prestamoId', ParseIntPipe) id: number) { return responses(await this.generar.execute(id)); }
  @Post('prestamo/:prestamoId/personalizado') @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR) @ApiOperation({ summary: 'Crear plan personalizado', description: 'Ejemplo: cinco cuotas semanales de 24.000 para un total de 120.000.' }) @ApiParam({ name: 'prestamoId', example: 10 }) @ApiBody({ type: PlanPagoPersonalizadoDto }) @ApiResponse({ status: 201, type: [PlanPagoResponseDto] })
  async crearPersonalizado(@Param('prestamoId', ParseIntPipe) id: number, @Body() dto: PlanPagoPersonalizadoDto) { return responses(await this.personalizado.execute(id, dto)); }
  @Get('prestamo/:prestamoId') @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR) @ApiOperation({ summary: 'Listar plan de un préstamo' }) @ApiParam({ name: 'prestamoId', example: 10 }) @ApiResponse({ status: 200, type: [PlanPagoResponseDto] })
  async listarPlan(@Param('prestamoId', ParseIntPipe) id: number) { return responses(await this.listar.execute(id)); }
  @Get(':id') @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR) @ApiOperation({ summary: 'Obtener una cuota' }) @ApiParam({ name: 'id', example: 1 }) @ApiResponse({ status: 200, type: PlanPagoResponseDto }) @ApiResponse({ status: 404, description: 'Cuota del plan de pago no encontrada.' })
  async obtenerCuota(@Param('id', ParseIntPipe) id: number) { return response(await this.obtener.execute(id)); }
  @Put('prestamo/:prestamoId') @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR) @ApiOperation({ summary: 'Modificar plan personalizado', description: 'Reemplaza todas las cuotas de forma atómica y marca el préstamo como personalizado.' }) @ApiParam({ name: 'prestamoId', example: 10 }) @ApiBody({ type: PlanPagoPersonalizadoDto }) @ApiResponse({ status: 200, type: [PlanPagoResponseDto] })
  async modificar(@Param('prestamoId', ParseIntPipe) id: number, @Body() dto: PlanPagoPersonalizadoDto) { return responses(await this.actualizar.execute(id, dto)); }
}
