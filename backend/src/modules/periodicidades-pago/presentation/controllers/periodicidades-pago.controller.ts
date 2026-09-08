import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ActualizarPeriodicidadPagoDto } from '../../application/dto/actualizar-periodicidad-pago.dto';
import { CambiarEstadoPeriodicidadPagoDto } from '../../application/dto/cambiar-estado-periodicidad-pago.dto';
import { CrearPeriodicidadPagoDto } from '../../application/dto/crear-periodicidad-pago.dto';
import { ActualizarPeriodicidadPagoUseCase } from '../../application/use-cases/actualizar-periodicidad-pago.use-case';
import { CambiarEstadoPeriodicidadPagoUseCase } from '../../application/use-cases/cambiar-estado-periodicidad-pago.use-case';
import { CrearPeriodicidadPagoUseCase } from '../../application/use-cases/crear-periodicidad-pago.use-case';
import { ListarPeriodicidadesPagoUseCase } from '../../application/use-cases/listar-periodicidades-pago.use-case';
import { ObtenerPeriodicidadPagoUseCase } from '../../application/use-cases/obtener-periodicidad-pago.use-case';
import { PeriodicidadPagoResponseDto } from '../dto/periodicidad-pago-response.dto';
import { Roles } from '../../../auth/auth.decorators';
import { RolUsuario } from '../../../usuarios/domain/enums/rol-usuario.enum';
import { FiltrosPeriodicidadesPagoAdministracionDto } from '../../application/dto/filtros-periodicidades-pago-administracion.dto';
import { ListarPeriodicidadesPagoAdministracionUseCase } from '../../application/use-cases/listar-periodicidades-pago-administracion.use-case';
import { PeriodicidadesPagoPaginadosResponseDto } from '../dto/periodicidades-pago-paginados-response.dto';

@ApiTags('Periodicidades de pago')
@ApiBearerAuth()
@Controller('periodicidades-pago')
export class PeriodicidadesPagoController {
  constructor(
    private readonly crearUseCase: CrearPeriodicidadPagoUseCase,
    private readonly listarUseCase: ListarPeriodicidadesPagoUseCase,
    private readonly obtenerUseCase: ObtenerPeriodicidadPagoUseCase,
    private readonly actualizarUseCase: ActualizarPeriodicidadPagoUseCase,
    private readonly cambiarEstadoUseCase: CambiarEstadoPeriodicidadPagoUseCase,
    private readonly listarAdministracionUseCase: ListarPeriodicidadesPagoAdministracionUseCase,
  ) {}

  @Post()
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Crear una periodicidad de pago', description: 'Registra una nueva periodicidad de pago en el sistema.' })
  @ApiBody({ type: CrearPeriodicidadPagoDto, schema: { type: 'object', example: { nombre: 'Semanal' } } })
  @ApiResponse({ status: 201, description: 'Periodicidad de pago creada correctamente.', type: PeriodicidadPagoResponseDto, example: { id: 1, nombre: 'Semanal', activo: true } })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 409, description: 'Ya existe una periodicidad de pago con ese nombre.', example: { statusCode: 409, message: 'Ya existe una periodicidad de pago con ese nombre.', error: 'Conflict' } })
  crear(@Body() dto: CrearPeriodicidadPagoDto) {
    return this.crearUseCase.execute(dto);
  }

  @Get()
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
  @ApiOperation({ summary: 'Listar periodicidades de pago', description: 'Obtiene todas las periodicidades de pago registradas, incluyendo activas e inactivas.' })
  @ApiResponse({ status: 200, description: 'Listado de periodicidades de pago obtenido correctamente.', type: PeriodicidadPagoResponseDto, isArray: true, example: [{ id: 1, nombre: 'Diario', activo: true }, { id: 2, nombre: 'Semanal', activo: true }, { id: 3, nombre: 'Quincenal', activo: true }, { id: 4, nombre: 'Mensual', activo: true }] })
  listar() {
    return this.listarUseCase.execute();
  }

  @Get('administracion')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
  @ApiOperation({ summary: 'Listar periodicidades de pago para administración con paginación' })
  @ApiQuery({ name: 'pagina', required: false, type: Number, default: 1 })
  @ApiQuery({ name: 'limite', required: false, type: Number, default: 10, maximum: 100 })
  @ApiResponse({ status: 200, type: PeriodicidadesPagoPaginadosResponseDto })
  listarAdministracion(@Query() dto: FiltrosPeriodicidadesPagoAdministracionDto) {
    return this.listarAdministracionUseCase.execute(dto);
  }

  @Get(':id')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
  @ApiOperation({ summary: 'Obtener una periodicidad de pago', description: 'Obtiene una periodicidad de pago por su identificador.' })
  @ApiParam({ name: 'id', description: 'Identificador de la periodicidad de pago', example: 1 })
  @ApiResponse({ status: 200, description: 'Periodicidad de pago obtenida correctamente.', type: PeriodicidadPagoResponseDto, example: { id: 1, nombre: 'Semanal', activo: true } })
  @ApiResponse({ status: 404, description: 'Periodicidad de pago no encontrada.', example: { statusCode: 404, message: 'Periodicidad de pago no encontrada.', error: 'Not Found' } })
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.obtenerUseCase.execute(id);
  }

  @Put(':id')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Actualizar una periodicidad de pago', description: 'Modifica el nombre de una periodicidad de pago existente.' })
  @ApiParam({ name: 'id', description: 'Identificador de la periodicidad de pago', example: 1 })
  @ApiBody({ type: ActualizarPeriodicidadPagoDto, schema: { type: 'object', example: { nombre: 'Quincenal' } } })
  @ApiResponse({ status: 200, description: 'Periodicidad de pago actualizada correctamente.', type: PeriodicidadPagoResponseDto, example: { id: 1, nombre: 'Quincenal', activo: true } })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 404, description: 'Periodicidad de pago no encontrada.', example: { statusCode: 404, message: 'Periodicidad de pago no encontrada.', error: 'Not Found' } })
  @ApiResponse({ status: 409, description: 'Ya existe una periodicidad de pago con ese nombre.', example: { statusCode: 409, message: 'Ya existe una periodicidad de pago con ese nombre.', error: 'Conflict' } })
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarPeriodicidadPagoDto) {
    return this.actualizarUseCase.execute(id, dto);
  }

  @Patch(':id/estado')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Activar o desactivar una periodicidad de pago', description: 'Cambia el estado de una periodicidad de pago sin eliminarla.' })
  @ApiParam({ name: 'id', description: 'Identificador de la periodicidad de pago', example: 1 })
  @ApiBody({ type: CambiarEstadoPeriodicidadPagoDto, description: 'Use false para desactivar o true para activar.', schema: { type: 'object', example: { activo: false } } })
  @ApiResponse({ status: 200, description: 'Estado de la periodicidad de pago actualizado correctamente.', type: PeriodicidadPagoResponseDto, example: { id: 1, nombre: 'Semanal', activo: false } })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 404, description: 'Periodicidad de pago no encontrada.', example: { statusCode: 404, message: 'Periodicidad de pago no encontrada.', error: 'Not Found' } })
  cambiarEstado(@Param('id', ParseIntPipe) id: number, @Body() dto: CambiarEstadoPeriodicidadPagoDto) {
    return this.cambiarEstadoUseCase.execute(id, dto.activo);
  }
}
