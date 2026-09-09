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
import { PrevisualizarRefinanciamientoUseCase } from '../../application/use-cases/previsualizar-refinanciamiento.use-case';
import { PrevisualizarRefinanciamientoResponseDto } from '../dto/previsualizar-refinanciamiento-response.dto';
import { ObtenerCadenasClienteUseCase } from '../../application/use-cases/obtener-cadenas-cliente.use-case';
import { CadenasClienteResponseDto } from '../dto/cadenas-cliente-response.dto';
import { calcularDiasGanados } from '../../application/services/calcular-dias-ganados';
const response = (v: RefinanciamientoConRelaciones): RefinanciamientoResponseDto => {
  const nuevo = v.prestamoNuevo!;
  const dineroNuevoDesembolsado = nuevo.montoDesembolsado;
  const capitalTotalNuevo = v.capitalPendiente + dineroNuevoDesembolsado;
  const interesTotalNuevo = v.interesNuevo;
  return { id: v.id!, prestamoOrigenId: v.prestamoOrigenId, prestamoNuevoId: v.prestamoNuevoId, fecha: v.fecha.toISOString().slice(0, 10), capitalPendiente: v.capitalPendiente, interesPendiente: v.interesPendiente, montoRefinanciado: v.montoRefinanciado, interesNuevo: v.interesNuevo, observaciones: v.observaciones, fechaCreacion: v.fechaCreacion, fechaLimiteContractualOrigen: v.fechaLimiteContractualOrigen?.toISOString().slice(0, 10) ?? null, diasGanados: calcularDiasGanados(v.fechaLimiteContractualOrigen, v.fecha), prestamoOrigen: v.prestamoOrigen, prestamoNuevo: nuevo, saldoAnterior: { capitalPendiente: v.capitalPendiente, interesPendiente: v.interesPendiente, montoRefinanciado: v.montoRefinanciado }, nuevaOperacion: { dineroNuevoDesembolsado, interesNuevo: v.interesNuevo }, composicion: { interesAnteriorPendiente: 0, interesNuevo: v.interesNuevo, interesTotalNuevo, capitalAnteriorPendiente: v.capitalPendiente, dineroNuevoDesembolsado, capitalTotalNuevo }, pagosOrigen: v.pagosOrigen, pagosNuevo: v.pagosNuevo, planNuevo: v.planNuevo };
};
const listadoResponse = (v: RefinanciamientoConRelaciones) => ({ ...response(v), cliente: v.cliente! });
@ApiTags('Refinanciamientos')
@ApiBearerAuth()
@Controller('refinanciamientos')
@Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
export class RefinanciamientosController {
  constructor(private readonly crear: CrearRefinanciamientoUseCase, private readonly queries: RefinanciamientoQueries, private readonly preview: PrevisualizarRefinanciamientoUseCase, private readonly cadenasCliente: ObtenerCadenasClienteUseCase) {}
  @Get('prestamo/:prestamoId/preview') @ApiOperation({ summary: 'Previsualizar elegibilidad de refinanciamiento', description: 'Consulta la elegibilidad sin crear refinanciamiento, plan ni movimiento de Caja.' }) @ApiParam({ name: 'prestamoId', type: Number }) @ApiResponse({ status: 200, type: PrevisualizarRefinanciamientoResponseDto }) @ApiResponse({ status: 404, description: 'Préstamo no encontrado.' })
  async previsualizar(@Param('prestamoId', ParseIntPipe) id: number) { return this.preview.execute(id); }
  @Post() @ApiOperation({ summary: 'Crear un refinanciamiento', description: 'Refinancia el capital pendiente de un préstamo activo cuando el interés pactado ya fue cubierto, sin registrar un pago ficticio. El nuevo desembolso representa únicamente dinero nuevo entregado.' }) @ApiBody({ type: CrearRefinanciamientoDto, description: 'Ejemplo: préstamo de capital 100.000 e interés 20.000, con 30.000 pagados, dinero nuevo 40.000 e interés nuevo 25.000, produce capital nuevo 130.000, interés total 25.000, total 155.000 y desembolso real 40.000.' }) @ApiResponse({ status: 201, type: RefinanciamientoResponseDto }) @ApiResponse({ status: 400, description: 'Interés no cubierto, saldo, estado, catálogo o plan inválido.' }) @ApiResponse({ status: 404, description: 'Préstamo, periodicidad o forma de pago no encontrada.' }) @ApiResponse({ status: 409, description: 'El préstamo ya fue refinanciado.' })
  async crearRefinanciamiento(@Body() dto: CrearRefinanciamientoDto, @Req() request: AuthenticatedRequest) { return response(await this.crear.execute(dto, authenticatedUserId(request))); }
  @Get() @ApiOperation({ summary: 'Listar refinanciamientos', description: 'Listado paginado ordenado por fecha e identificador descendente.' }) @ApiQuery({ name: 'pagina', required: false, type: Number }) @ApiQuery({ name: 'limite', required: false, type: Number }) @ApiQuery({ name: 'buscar', required: false }) @ApiQuery({ name: 'clienteId', required: false, type: Number }) @ApiQuery({ name: 'fechaDesde', required: false, type: String }) @ApiQuery({ name: 'fechaHasta', required: false, type: String }) @ApiResponse({ status: 200, type: RefinanciamientosPaginadosResponseDto })
  async listar(@Query() dto: FiltrosRefinanciamientosDto) { const r = await this.queries.listar(dto); return { ...r, datos: r.datos.map(listadoResponse) }; }
  @Get('cliente/:clienteId/cadenas') @ApiOperation({ summary: 'Obtener cadenas de refinanciamiento del cliente', description: 'Construye las cadenas exclusivamente con las FK prestamoOrigenId -> prestamoNuevoId. Capital trasladado proviene de capitalPendiente; dinero nuevo del desembolso real; interés nuevo de interesNuevo.' }) @ApiParam({ name: 'clienteId', type: Number }) @ApiResponse({ status: 200, type: CadenasClienteResponseDto }) @ApiResponse({ status: 404, description: 'Cliente no encontrado.' }) @ApiResponse({ status: 409, description: 'Corrupción estructural o relación cruzada entre clientes.' })
  async cadenasPorCliente(@Param('clienteId', ParseIntPipe) clienteId: number) { return this.cadenasCliente.execute(clienteId); }
  @Get('prestamo-origen/:prestamoId') @ApiOperation({ summary: 'Buscar por préstamo origen' }) @ApiParam({ name: 'prestamoId', type: Number }) @ApiResponse({ status: 200, type: RefinanciamientoResponseDto }) @ApiResponse({ status: 404, description: 'Refinanciamiento no encontrado.' }) async origen(@Param('prestamoId', ParseIntPipe) id: number) { return response(await this.queries.origen(id)); }
  @Get('prestamo-nuevo/:prestamoId') @ApiOperation({ summary: 'Buscar por préstamo nuevo' }) @ApiParam({ name: 'prestamoId', type: Number }) @ApiResponse({ status: 200, type: RefinanciamientoResponseDto }) @ApiResponse({ status: 404, description: 'Refinanciamiento no encontrado.' }) async nuevo(@Param('prestamoId', ParseIntPipe) id: number) { return response(await this.queries.nuevo(id)); }
  @Get('prestamo/:prestamoId/cadena') @ApiOperation({ summary: 'Obtener cadena de refinanciamientos' }) @ApiParam({ name: 'prestamoId', type: Number }) @ApiResponse({ status: 200, type: [RefinanciamientoResponseDto] }) @ApiResponse({ status: 404, description: 'Refinanciamiento no encontrado.' }) async cadena(@Param('prestamoId', ParseIntPipe) id: number) { return (await this.queries.cadena(id)).map(response); }
  @Get(':id') @ApiOperation({ summary: 'Obtener detalle' }) @ApiParam({ name: 'id', type: Number }) async detalle(@Param('id', ParseIntPipe) id: number) { return response(await this.queries.detalle(id)); }
}
