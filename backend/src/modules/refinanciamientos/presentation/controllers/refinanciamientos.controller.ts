import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrearRefinanciamientoDto } from '../../application/dto/crear-refinanciamiento.dto';
import { FiltrosRefinanciamientosDto } from '../../application/dto/filtros-refinanciamientos.dto';
import { CrearRefinanciamientoUseCase } from '../../application/use-cases/crear-refinanciamiento.use-case';
import { RefinanciamientoQueries } from '../../application/use-cases/refinanciamiento-queries.use-cases';
import { RefinanciamientoConRelaciones } from '../../domain/repositories/refinanciamiento.repository';
import { RefinanciamientoResponseDto } from '../dto/refinanciamiento-response.dto';
import { RefinanciamientosPaginadosResponseDto } from '../dto/refinanciamientos-paginados-response.dto';
import { authenticatedUserId, AuthenticatedRequest } from '../../../../common/authenticated-user';
import { Roles } from '../../../auth/auth.decorators';
import { RolUsuario } from '../../../usuarios/domain/enums/rol-usuario.enum';
const response = (v: RefinanciamientoConRelaciones): RefinanciamientoResponseDto => {
  const nuevo = v.prestamoNuevo!;
  const dineroNuevoDesembolsado = nuevo.montoDesembolsado;
  const capitalTotalNuevo = v.capitalPendiente + dineroNuevoDesembolsado;
  const interesTotalNuevo = v.interesPendiente + v.interesNuevo;
  return { id: v.id!, prestamoOrigenId: v.prestamoOrigenId, prestamoNuevoId: v.prestamoNuevoId, fecha: v.fecha.toISOString().slice(0, 10), capitalPendiente: v.capitalPendiente, interesPendiente: v.interesPendiente, montoRefinanciado: v.montoRefinanciado, interesNuevo: v.interesNuevo, observaciones: v.observaciones, fechaCreacion: v.fechaCreacion, prestamoOrigen: v.prestamoOrigen, prestamoNuevo: nuevo, saldoAnterior: { capitalPendiente: v.capitalPendiente, interesPendiente: v.interesPendiente, montoRefinanciado: v.montoRefinanciado }, nuevaOperacion: { dineroNuevoDesembolsado, interesNuevo: v.interesNuevo }, composicion: { interesAnteriorPendiente: v.interesPendiente, interesNuevo: v.interesNuevo, interesTotalNuevo, capitalAnteriorPendiente: v.capitalPendiente, dineroNuevoDesembolsado, capitalTotalNuevo }, pagosOrigen: v.pagosOrigen, pagosNuevo: v.pagosNuevo, planNuevo: v.planNuevo };
};
@ApiTags('Refinanciamientos')
@ApiBearerAuth()
@Controller('refinanciamientos')
@Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
export class RefinanciamientosController {
  constructor(private readonly crear: CrearRefinanciamientoUseCase, private readonly queries: RefinanciamientoQueries) {}
  @Post() @ApiOperation({ summary: 'Crear un refinanciamiento', description: 'Traslada el saldo pendiente de un préstamo activo a un nuevo préstamo sin registrar un pago ficticio. El interés pendiente conserva su naturaleza de interés y el nuevo desembolso representa únicamente dinero nuevo entregado.' }) @ApiBody({ type: CrearRefinanciamientoDto, description: 'Ejemplo: capital pendiente 4.000, interés pendiente 20.000, dinero nuevo 76.000 e interés nuevo 20.000 producen capital nuevo 80.000, interés total 40.000, total 120.000 y desembolso real 76.000.' }) @ApiResponse({ status: 201, type: RefinanciamientoResponseDto }) @ApiResponse({ status: 400, description: 'Saldo, estado, catálogo o plan inválido.' }) @ApiResponse({ status: 404, description: 'Préstamo, periodicidad o forma de pago no encontrada.' }) @ApiResponse({ status: 409, description: 'El préstamo ya fue refinanciado.' })
  async crearRefinanciamiento(@Body() dto: CrearRefinanciamientoDto, @Req() request: AuthenticatedRequest) { return response(await this.crear.execute(dto, authenticatedUserId(request))); }
  @Get() @ApiOperation({ summary: 'Listar refinanciamientos', description: 'Listado paginado ordenado por fecha e identificador descendente.' }) @ApiQuery({ name: 'pagina', required: false, type: Number }) @ApiQuery({ name: 'limite', required: false, type: Number }) @ApiQuery({ name: 'buscar', required: false }) @ApiQuery({ name: 'clienteId', required: false, type: Number }) @ApiQuery({ name: 'fechaDesde', required: false, type: String }) @ApiQuery({ name: 'fechaHasta', required: false, type: String }) @ApiResponse({ status: 200, type: RefinanciamientosPaginadosResponseDto })
  async listar(@Query() dto: FiltrosRefinanciamientosDto) { const r = await this.queries.listar(dto); return { ...r, datos: r.datos.map(response) }; }
  @Get('prestamo-origen/:prestamoId') @ApiOperation({ summary: 'Buscar por préstamo origen' }) @ApiParam({ name: 'prestamoId', type: Number }) @ApiResponse({ status: 200, type: RefinanciamientoResponseDto }) @ApiResponse({ status: 404, description: 'Refinanciamiento no encontrado.' }) async origen(@Param('prestamoId', ParseIntPipe) id: number) { return response(await this.queries.origen(id)); }
  @Get('prestamo-nuevo/:prestamoId') @ApiOperation({ summary: 'Buscar por préstamo nuevo' }) @ApiParam({ name: 'prestamoId', type: Number }) @ApiResponse({ status: 200, type: RefinanciamientoResponseDto }) @ApiResponse({ status: 404, description: 'Refinanciamiento no encontrado.' }) async nuevo(@Param('prestamoId', ParseIntPipe) id: number) { return response(await this.queries.nuevo(id)); }
  @Get('prestamo/:prestamoId/cadena') @ApiOperation({ summary: 'Obtener cadena de refinanciamientos' }) @ApiParam({ name: 'prestamoId', type: Number }) @ApiResponse({ status: 200, type: [RefinanciamientoResponseDto] }) @ApiResponse({ status: 404, description: 'Refinanciamiento no encontrado.' }) async cadena(@Param('prestamoId', ParseIntPipe) id: number) { return (await this.queries.cadena(id)).map(response); }
  @Get(':id') @ApiOperation({ summary: 'Obtener detalle' }) @ApiParam({ name: 'id', type: Number }) async detalle(@Param('id', ParseIntPipe) id: number) { return response(await this.queries.detalle(id)); }
}
