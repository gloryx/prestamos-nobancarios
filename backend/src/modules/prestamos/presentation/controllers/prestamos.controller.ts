import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ActualizarPrestamoDto } from '../../application/dto/actualizar-prestamo.dto';
import { CambiarEstadoPrestamoDto } from '../../application/dto/cambiar-estado-prestamo.dto';
import { CrearPrestamoDto } from '../../application/dto/crear-prestamo.dto';
import { FiltrosPrestamosDto } from '../../application/dto/filtros-prestamos.dto';
import { ActualizarPrestamoUseCase } from '../../application/use-cases/actualizar-prestamo.use-case';
import { CambiarEstadoPrestamoUseCase } from '../../application/use-cases/cambiar-estado-prestamo.use-case';
import { CrearPrestamoUseCase } from '../../application/use-cases/crear-prestamo.use-case';
import { ListarPrestamosUseCase } from '../../application/use-cases/listar-prestamos.use-case';
import { ObtenerPrestamoPorIdUseCase } from '../../application/use-cases/obtener-prestamo-por-id.use-case';
import { EstadoPrestamo } from '../../domain/enums/estado-prestamo.enum';
import { PrestamoConRelaciones } from '../../domain/repositories/prestamo.repository';
import { PrestamoResponseDto } from '../dto/prestamo-response.dto';
import { PrestamosPaginadosResponseDto } from '../dto/prestamos-paginados-response.dto';
import { authenticatedUserId, AuthenticatedRequest } from '../../../../common/authenticated-user';
import { Roles } from '../../../auth/auth.decorators';
import { RolUsuario } from '../../../usuarios/domain/enums/rol-usuario.enum';
import { PrestamoEstadoHistorialService } from '../../application/services/prestamo-estado-historial.service';

const response = (value: PrestamoConRelaciones): PrestamoResponseDto => ({ ...value, id: value.id!, fechaAlta: value.fechaAlta.toISOString().slice(0, 10), cliente: { id: value.cliente.id, identificacion: value.cliente.identificacion!, nombreCompleto: value.cliente.nombre! } });
@ApiTags('Préstamos')
@ApiBearerAuth()
@Controller('prestamos')
export class PrestamosController {
  constructor(private readonly crear: CrearPrestamoUseCase, private readonly listarUseCase: ListarPrestamosUseCase, private readonly obtenerUseCase: ObtenerPrestamoPorIdUseCase, private readonly actualizarUseCase: ActualizarPrestamoUseCase, private readonly estadoUseCase: CambiarEstadoPrestamoUseCase, private readonly history: PrestamoEstadoHistorialService) {}
  @Post()
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
  @ApiOperation({ summary: 'Crear un préstamo', description: 'Registra un préstamo asociado a un cliente activo.' })
  @ApiBody({ type: CrearPrestamoDto, schema: { type: 'object', example: { clienteId: 1, periodicidadPagoId: 2, formaPagoId: 1, fechaAlta: '2026-08-30', capital: 100000, interes: 15000, cantidadPagos: 12, planPersonalizado: false, observaciones: 'Préstamo para capital de trabajo.' } } })
  @ApiResponse({ status: 201, description: 'Préstamo creado correctamente.', type: PrestamoResponseDto }) @ApiResponse({ status: 400, description: 'Datos inválidos o referencia inactiva.' }) @ApiResponse({ status: 404, description: 'Referencia no encontrada.' })
  async crearPrestamo(@Body() dto: CrearPrestamoDto, @Req() request: AuthenticatedRequest) { return response(await this.crear.execute(dto, authenticatedUserId(request))); }
  @Get()
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
  @ApiOperation({ summary: 'Listar préstamos', description: 'Obtiene préstamos con búsqueda, filtros y paginación.' })
  @ApiQuery({ name: 'pagina', required: false, type: Number, example: 1, default: 1 }) @ApiQuery({ name: 'limite', required: false, type: Number, example: 10, default: 10, maximum: 100 }) @ApiQuery({ name: 'buscar', required: false, example: 'perez' }) @ApiQuery({ name: 'estado', required: false, enum: EstadoPrestamo, example: EstadoPrestamo.ACTIVO }) @ApiQuery({ name: 'clienteId', required: false, type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Listado obtenido correctamente.', type: PrestamosPaginadosResponseDto })
  async listar(@Query() dto: FiltrosPrestamosDto) { const result = await this.listarUseCase.execute(dto); return { ...result, datos: result.datos.map(response) }; }
  @Get(':id/historial-estados')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
  async historialEstados(@Param('id', ParseIntPipe) id: number) { await this.obtenerUseCase.execute(id); return (await this.history.listar(id)).map(h => ({ id: h.id, estadoAnterior: h.estadoAnterior, estadoNuevo: h.estadoNuevo, fecha: h.fecha.toISOString().slice(0, 10), observacion: h.observacion, usuario: h.usuario ? { id: h.usuario.id, nombreCompleto: h.usuario.nombreCompleto } : null })); }
  @Get(':id')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
  @ApiOperation({ summary: 'Obtener un préstamo', description: 'Obtiene un préstamo por su identificador.' }) @ApiParam({ name: 'id', example: 1 }) @ApiResponse({ status: 200, type: PrestamoResponseDto }) @ApiResponse({ status: 404, description: 'Préstamo no encontrado.' })
  async obtener(@Param('id', ParseIntPipe) id: number) { return response(await this.obtenerUseCase.execute(id)); }
  @Put(':id')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
  @ApiOperation({ summary: 'Actualizar un préstamo', description: 'Actualiza los datos editables de un préstamo activo.' }) @ApiParam({ name: 'id', example: 1 }) @ApiBody({ type: ActualizarPrestamoDto }) @ApiResponse({ status: 200, type: PrestamoResponseDto }) @ApiResponse({ status: 400, description: 'Datos inválidos o préstamo no activo.' }) @ApiResponse({ status: 404, description: 'Préstamo o referencia no encontrada.' })
  async actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarPrestamoDto) { return response(await this.actualizarUseCase.execute(id, dto)); }
  @Patch(':id/estado')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Cambiar estado de un préstamo', description: 'Permite únicamente ACTIVO a INCOBRABLE e INCOBRABLE a ACTIVO.' }) @ApiParam({ name: 'id', example: 1 }) @ApiBody({ type: CambiarEstadoPrestamoDto, schema: { example: { estado: EstadoPrestamo.INCOBRABLE } } }) @ApiResponse({ status: 200, type: PrestamoResponseDto }) @ApiResponse({ status: 400, description: 'Transición de estado inválida.' }) @ApiResponse({ status: 404, description: 'Préstamo no encontrado.' })
  async cambiarEstado(@Param('id', ParseIntPipe) id: number, @Body() dto: CambiarEstadoPrestamoDto, @Req() request: AuthenticatedRequest) { return response(await this.estadoUseCase.execute(id, dto, authenticatedUserId(request))); }
}
