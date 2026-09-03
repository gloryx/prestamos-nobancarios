import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { authenticatedUserId, AuthenticatedRequest } from '../../../../common/authenticated-user';
import { CrearIngresoDto, ActualizarIngresoDto, FiltrosIngresosDto } from '../../application/dto/ingreso.dto';
import { ActualizarIngresoUseCase, CrearIngresoUseCase, ListarIngresosUseCase, ObtenerIngresoUseCase } from '../../application/use-cases/ingreso.use-cases';
import { IngresoResponseDto, IngresosPaginadosResponseDto } from '../dto/ingreso-response.dto';
import { Roles } from '../../../auth/auth.decorators';
import { RolUsuario } from '../../../usuarios/domain/enums/rol-usuario.enum';

const safe = (v: any) => ({ ...v, fuenteIngreso: v.fuenteIngreso && { id: v.fuenteIngreso.id, nombre: v.fuenteIngreso.nombre, activo: v.fuenteIngreso.activo }, usuario: v.usuario && { id: v.usuario.id, nombreCompleto: v.usuario.nombreCompleto } });

@ApiTags('Ingresos')
@ApiBearerAuth()
@Controller('ingresos')
export class IngresosController {
  constructor(private crear: CrearIngresoUseCase, private listar: ListarIngresosUseCase, private obtener: ObtenerIngresoUseCase, private actualizar: ActualizarIngresoUseCase) {}

  @Post()
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Registrar un ingreso', description: 'Registra un ingreso asociado a una fuente de ingreso activa.' })
  @ApiBody({ type: CrearIngresoDto })
  @ApiResponse({ status: 201, description: 'Ingreso creado correctamente.', type: IngresoResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos o fuente de ingreso inactiva.' })
  @ApiResponse({ status: 404, description: 'Fuente de ingreso no encontrada.' })
  async crearIngreso(@Body() dto: CrearIngresoDto, @Req() request: AuthenticatedRequest) { return safe(await this.crear.execute(dto, authenticatedUserId(request))); }

  @Get()
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
  @ApiOperation({ summary: 'Listar ingresos', description: 'Obtiene ingresos con paginación, búsqueda, fuente y rango de fechas.' })
  @ApiQuery({ name: 'page', required: false, type: Number, default: 1, minimum: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, default: 10, minimum: 1, maximum: 100 })
  @ApiQuery({ name: 'fuenteIngresoId', required: false, type: Number, minimum: 1 })
  @ApiQuery({ name: 'fechaDesde', required: false, type: String })
  @ApiQuery({ name: 'fechaHasta', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Listado de ingresos obtenido correctamente.', type: IngresosPaginadosResponseDto })
  async listarIngresos(@Query() dto: FiltrosIngresosDto) { const r = await this.listar.execute(dto); return { ...r, datos: r.datos.map(safe) }; }

  @Get(':id')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
  @ApiOperation({ summary: 'Obtener un ingreso', description: 'Obtiene un ingreso por su identificador.' })
  @ApiResponse({ status: 200, description: 'Ingreso obtenido correctamente.', type: IngresoResponseDto })
  @ApiResponse({ status: 404, description: 'Ingreso no encontrado.' })
  async obtenerIngreso(@Param('id', ParseIntPipe) id: number) { return safe(await this.obtener.execute(id)); }

  @Put(':id')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Actualizar un ingreso', description: 'Actualiza un ingreso existente.' })
  @ApiBody({ type: ActualizarIngresoDto })
  @ApiResponse({ status: 200, description: 'Ingreso actualizado correctamente.', type: IngresoResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos o fuente de ingreso inactiva.' })
  @ApiResponse({ status: 404, description: 'Ingreso o fuente de ingreso no encontrada.' })
  async actualizarIngreso(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarIngresoDto) { return safe(await this.actualizar.execute(id, dto)); }
}
