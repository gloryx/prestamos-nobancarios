import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrearPagoDto } from '../../application/dto/crear-pago.dto';
import { EstadoPlanQueryDto } from '../../application/dto/estado-plan-query.dto';
import { FiltrosPagosDto } from '../../application/dto/filtros-pagos.dto';
import { ListarPagosPorPrestamoUseCase } from '../../application/use-cases/listar-pagos-por-prestamo.use-case';
import { ListarPagosUseCase } from '../../application/use-cases/listar-pagos.use-case';
import { ObtenerEstadoPlanUseCase } from '../../application/use-cases/obtener-estado-plan.use-case';
import { ObtenerPagoPorIdUseCase } from '../../application/use-cases/obtener-pago-por-id.use-case';
import { ObtenerResumenPagoPrestamoUseCase } from '../../application/use-cases/obtener-resumen-pago-prestamo.use-case';
import { RegistrarPagoUseCase } from '../../application/use-cases/registrar-pago.use-case';
import { PagoConRelaciones } from '../../domain/repositories/pago.repository';
import { PagoResponseDto, PagosPaginadosResponseDto } from '../dto/pago-response.dto';
import { EstadoPlanResponseDto } from '../dto/estado-plan-response.dto';
import { authenticatedUserId, AuthenticatedRequest } from '../../../../common/authenticated-user';
import { Roles } from '../../../auth/auth.decorators';
import { RolUsuario } from '../../../usuarios/domain/enums/rol-usuario.enum';

const response = (pago: PagoConRelaciones): PagoResponseDto => ({ id: pago.id!, prestamoId: pago.prestamoId, formaPagoId: pago.formaPagoId, monto: pago.monto, capitalAplicado: pago.capitalAplicado, interesAplicado: pago.interesAplicado, cobradorId: pago.cobradorId, fecha: pago.fecha.toISOString().slice(0, 10), fechaCreacion: pago.fechaCreacion, observaciones: pago.observaciones, formaPago: pago.formaPago, prestamo: pago.prestamo, cliente: pago.cliente, cobrador: pago.cobrador });

@ApiTags('Pagos')
@ApiBearerAuth()
@Controller('pagos')
@Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
export class PagosController {
  constructor(private readonly registrar: RegistrarPagoUseCase, private readonly listarUseCase: ListarPagosUseCase, private readonly obtener: ObtenerPagoPorIdUseCase, private readonly listarPrestamo: ListarPagosPorPrestamoUseCase, private readonly resumen: ObtenerResumenPagoPrestamoUseCase, private readonly estadoPlan: ObtenerEstadoPlanUseCase) {}
  @Post() @ApiOperation({ summary: 'Registrar un pago' }) @ApiBody({ type: CrearPagoDto, schema: { example: { prestamoId: 10, formaPagoId: 1, cobradorId: 7, monto: 24000, fecha: '2026-08-30', observaciones: 'Pago de cuota 1.' } } }) @ApiResponse({ status: 201, type: PagoResponseDto }) @ApiResponse({ status: 400, description: 'Datos inválidos, forma de pago inactiva o cobrador inactivo.' }) @ApiResponse({ status: 404, description: 'Préstamo, forma de pago o cobrador no encontrado.' })
  async crear(@Body() dto: CrearPagoDto, @Req() request: AuthenticatedRequest) { return response(await this.registrar.execute(dto, authenticatedUserId(request))); }
  @Get() @ApiOperation({ summary: 'Listar pagos' }) @ApiQuery({ name: 'pagina', required: false, type: Number, default: 1 }) @ApiQuery({ name: 'limite', required: false, type: Number, default: 10, maximum: 100 }) @ApiQuery({ name: 'formaPagoId', required: false, type: Number }) @ApiQuery({ name: 'cobradorId', required: false, type: Number }) @ApiResponse({ status: 200, type: PagosPaginadosResponseDto })
  async listar(@Query() dto: FiltrosPagosDto) { const result = await this.listarUseCase.execute(dto); return { ...result, datos: result.datos.map(response) }; }
  @Get('prestamo/:prestamoId/resumen') @ApiOperation({ summary: 'Obtener resumen de pagos' }) @ApiParam({ name: 'prestamoId', example: 10 }) @ApiResponse({ status: 200, description: 'Capital, interés y saldos acumulados.' }) @ApiResponse({ status: 404, description: 'Préstamo no encontrado.' })
  resumenPago(@Param('prestamoId', ParseIntPipe) id: number) { return this.resumen.execute(id); }
  @Get('prestamo/:prestamoId/estado-plan') @ApiOperation({ summary: 'Obtener estado dinámico del plan' }) @ApiParam({ name: 'prestamoId', example: 10 }) @ApiQuery({ name: 'fecha', required: false, type: String, example: '2026-08-30', description: 'Fecha de análisis estricta y calendario válida en formato YYYY-MM-DD.' }) @ApiResponse({ status: 200, description: 'Estado calculado sin modificar el plan.', type: EstadoPlanResponseDto }) @ApiResponse({ status: 400, description: 'Fecha inválida.' }) @ApiResponse({ status: 404, description: 'Préstamo o plan de pago no encontrado.' })
  estado(@Param('prestamoId', ParseIntPipe) id: number, @Query() query: EstadoPlanQueryDto) { return this.estadoPlan.execute(id, query); }
  @Get('prestamo/:prestamoId') @ApiOperation({ summary: 'Listar pagos de un préstamo' }) @ApiParam({ name: 'prestamoId', example: 10 })
  async listarPorPrestamo(@Param('prestamoId', ParseIntPipe) id: number) { return (await this.listarPrestamo.execute(id)).map(response); }
  @Get(':id') @ApiOperation({ summary: 'Obtener un pago' }) @ApiParam({ name: 'id', example: 1 }) @ApiResponse({ status: 200, type: PagoResponseDto }) @ApiResponse({ status: 404, description: 'Pago no encontrado.' })
  async obtenerPorId(@Param('id', ParseIntPipe) id: number) { return response(await this.obtener.execute(id)); }
}
