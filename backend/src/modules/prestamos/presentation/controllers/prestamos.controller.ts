import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Req, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ActualizarPrestamoDto } from '../../application/dto/actualizar-prestamo.dto';
import { CambiarEstadoPrestamoDto } from '../../application/dto/cambiar-estado-prestamo.dto';
import { AnularPrestamoDto } from '../../application/dto/anular-prestamo.dto';
import { CrearPrestamoDto } from '../../application/dto/crear-prestamo.dto';
import { FiltrosPrestamosDto } from '../../application/dto/filtros-prestamos.dto';
import { ActualizarPrestamoUseCase } from '../../application/use-cases/actualizar-prestamo.use-case';
import { ExportarPrestamosExcelUseCase } from '../../application/use-cases/exportar-prestamos-excel.use-case';
import { CambiarEstadoPrestamoUseCase } from '../../application/use-cases/cambiar-estado-prestamo.use-case';
import { CrearPrestamoUseCase } from '../../application/use-cases/crear-prestamo.use-case';
import { ListarPrestamosUseCase } from '../../application/use-cases/listar-prestamos.use-case';
import { ResumirPrestamosUseCase } from '../../application/use-cases/resumir-prestamos.use-case';
import { ObtenerPrestamoPorIdUseCase } from '../../application/use-cases/obtener-prestamo-por-id.use-case';
import { EstadoPrestamo } from '../../domain/enums/estado-prestamo.enum';
import { PrestamoConRelaciones } from '../../domain/repositories/prestamo.repository';
import { PrestamoDetalle } from '../../application/use-cases/obtener-prestamo-por-id.use-case';
import { PrestamoResponseDto } from '../dto/prestamo-response.dto';
import { PrestamosPaginadosResponseDto } from '../dto/prestamos-paginados-response.dto';
import { authenticatedUserId, AuthenticatedRequest } from '../../../../common/authenticated-user';
import { Roles } from '../../../auth/auth.decorators';
import { RolUsuario } from '../../../usuarios/domain/enums/rol-usuario.enum';
import { PrestamoEstadoHistorialService } from '../../application/services/prestamo-estado-historial.service';
import { PlanPagoPdfService } from '../../application/services/plan-pago-pdf.service';
import { IndicadorCobranzaService } from '../../application/services/indicador-cobranza.service';
import { AnularPrestamoUseCase } from '../../application/use-cases/anular-prestamo.use-case';
import { INDICADORES_COBRANZA } from '../../application/services/indicador-cobranza.service';
import { FiltrosIncobrablesDto } from '../../application/dto/filtros-incobrables.dto';
import { PrestamoIncobrableService } from '../../application/services/prestamo-incobrable.service';
import { ReporteRentabilidadCanceladosUseCase } from '../../application/use-cases/reporte-rentabilidad-cancelados.use-case';
import { ReporteRentabilidadCanceladosDto } from '../../application/dto/reporte-rentabilidad-cancelados.dto';
import { RentabilidadCanceladosResponseDto } from '../dto/reporte-rentabilidad-cancelados-response.dto';

export const response = (value: (PrestamoConRelaciones | PrestamoDetalle) & { capitalPendiente?: number; saldoPendiente?: number }): PrestamoResponseDto => ({ ...value, id: value.id!, fechaAlta: value.fechaAlta.toISOString().slice(0, 10), puedeAnular: value.puedeAnular ?? false, cliente: { id: value.cliente.id, identificacion: value.cliente.identificacion!, nombreCompleto: value.cliente.nombre!, direccion: value.cliente.direccion ?? null, telefono: value.cliente.telefono ?? null } } as PrestamoResponseDto);
@ApiTags('Préstamos')
@ApiBearerAuth()
@Controller('prestamos')
export class PrestamosController {
  constructor(private readonly crear: CrearPrestamoUseCase, private readonly listarUseCase: ListarPrestamosUseCase, private readonly resumirUseCase: ResumirPrestamosUseCase, private readonly exportarExcelUseCase: ExportarPrestamosExcelUseCase, private readonly obtenerUseCase: ObtenerPrestamoPorIdUseCase, private readonly actualizarUseCase: ActualizarPrestamoUseCase, private readonly estadoUseCase: CambiarEstadoPrestamoUseCase, private readonly anularUseCase: AnularPrestamoUseCase, private readonly history: PrestamoEstadoHistorialService, private readonly planPagoPdf: PlanPagoPdfService, private readonly cobranza: IndicadorCobranzaService, private readonly incobrables: PrestamoIncobrableService, private readonly rentabilidadCancelados: ReporteRentabilidadCanceladosUseCase) {}
  @Post()
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
  @ApiOperation({ summary: 'Crear un préstamo', description: 'Registra un préstamo asociado a un cliente activo.' })
  @ApiBody({ type: CrearPrestamoDto, schema: { type: 'object', example: { clienteId: 1, periodicidadPagoId: 2, formaPagoId: 1, formaDesembolsoId: 2, fechaAlta: '2026-08-30', capital: 100000, interes: 15000, cantidadPagos: 12, planPersonalizado: false, observaciones: 'Préstamo para capital de trabajo.' } } })
  @ApiResponse({ status: 201, description: 'Préstamo creado correctamente.', type: PrestamoResponseDto }) @ApiResponse({ status: 400, description: 'Datos inválidos o referencia inactiva.' }) @ApiResponse({ status: 404, description: 'Referencia no encontrada.' })
  async crearPrestamo(@Body() dto: CrearPrestamoDto, @Req() request: AuthenticatedRequest) { return response(await this.crear.execute(dto, authenticatedUserId(request))); }
  @Get('resumen')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
  @ApiQuery({ name: 'fechaCancelacionDesde', required: false, example: '2026-09-01', format: 'date', description: 'Fecha de cancelación real inicial inclusiva.' }) @ApiQuery({ name: 'fechaCancelacionHasta', required: false, example: '2026-09-30', format: 'date', description: 'Fecha de cancelación real final inclusiva.' })
  async resumen(@Query() dto: FiltrosPrestamosDto) { return this.resumirUseCase.execute(dto); }
  @Get('reporte/rentabilidad-cancelados')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
   @ApiOperation({ summary: 'Reporte mensual de rentabilidad REAL de cancelaciones', description: 'Representa eventos históricos de transición a CANCELADO ocurridos en el mes, aunque el préstamo tenga otro estado actualmente. La fecha de cancelación es la fecha del evento. Ganancia histórica = SUM(pago.interesAplicado) de pagos existentes a esa fecha y vigentes en ella: REGISTRADO cuenta; ANULADO cuenta solo si pago_anulacion.fecha es posterior. La igualdad de fechas excluye. rentabilidadTotal = gananciaTotal / capitalTotal × 100. tasa30Dias = ganancia / capital × 30 / días reales × 100, ponderada por capital.' })
  @ApiQuery({ name: 'anio', required: true, type: Number, example: 2026, description: 'Año calendario del mes económico a consultar (2000–2100).' })
  @ApiQuery({ name: 'mes', required: true, type: Number, example: 9, description: 'Mes económico de 1 a 12; no se permiten meses futuros.' })
  @ApiResponse({ status: 200, description: 'Reporte agregado calculado con hechos persistidos; no incluye detalle individual.', type: RentabilidadCanceladosResponseDto })
  async reporteRentabilidadCancelados(@Query() dto: ReporteRentabilidadCanceladosDto) { return this.rentabilidadCancelados.execute(dto); }
  @Get('export/excel')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
  async exportarExcel(@Query() dto: FiltrosPrestamosDto): Promise<StreamableFile> { const result = await this.exportarExcelUseCase.execute(dto); return new StreamableFile(result.buffer, { type: result.type, disposition: `attachment; filename="${result.filename}"` }); }
  @Get(':id/plan-pago/pdf') @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
  async planPagoPdfDocument(@Param('id', ParseIntPipe) id: number): Promise<StreamableFile> { const result = await this.planPagoPdf.execute(id); return new StreamableFile(result.buffer, { type: 'application/pdf', disposition: `inline; filename="Plan_Pago_${result.identificacion}_Prestamo_${id}.pdf"` }); }
  @Get(':id/estado-cuenta/pdf') @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
  async estadoCuentaPdf(@Param('id', ParseIntPipe) id: number): Promise<StreamableFile> { const result = await this.planPagoPdf.executeEstadoCuenta(id); return new StreamableFile(result.buffer, { type: 'application/pdf', disposition: `inline; filename="Estado_Cuenta_${result.identificacion}_Prestamo_${id}.pdf"` }); }
  @Get()
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
  @ApiOperation({ summary: 'Listar préstamos', description: 'Obtiene préstamos con búsqueda, filtros y paginación.' })
   @ApiQuery({ name: 'pagina', required: false, type: Number, example: 1, default: 1 }) @ApiQuery({ name: 'limite', required: false, type: Number, example: 10, default: 10, maximum: 100 }) @ApiQuery({ name: 'buscar', required: false, example: 'perez' }) @ApiQuery({ name: 'direccion', required: false, example: 'San José' }) @ApiQuery({ name: 'estados', required: false, example: 'ACTIVO,CANCELADO' }) @ApiQuery({ name: 'fechaInicio', required: false, example: '2026-01-01', format: 'date' }) @ApiQuery({ name: 'fechaFin', required: false, example: '2026-12-31', format: 'date' }) @ApiQuery({ name: 'fechaCancelacionDesde', required: false, example: '2026-09-01', format: 'date', description: 'Fecha de cancelación real inicial inclusiva.' }) @ApiQuery({ name: 'fechaCancelacionHasta', required: false, example: '2026-09-30', format: 'date', description: 'Fecha de cancelación real final inclusiva; se considera todo el día.' }) @ApiQuery({ name: 'estado', required: false, enum: EstadoPrestamo, example: EstadoPrestamo.ACTIVO }) @ApiQuery({ name: 'clienteId', required: false, type: Number, example: 1 }) @ApiQuery({ name: 'indicadorCobranza', required: false, enum: INDICADORES_COBRANZA }) @ApiQuery({ name: 'ordenarPor', required: false, enum: ['id', 'cliente', 'direccion', 'fechaAlta', 'fechaCancelacion', 'capital', 'saldoPendiente', 'estado', 'indicadorCobranza'] }) @ApiQuery({ name: 'direccionOrden', required: false, enum: ['ASC', 'DESC'] })
  @ApiResponse({ status: 200, description: 'Listado obtenido correctamente.', type: PrestamosPaginadosResponseDto })
  async listar(@Query() dto: FiltrosPrestamosDto) { const result = await this.listarUseCase.execute(dto); const cobranza = await this.cobranza.calcular(result.datos); return { ...result, datos: result.datos.map((prestamo) => ({ ...response(prestamo), ...cobranza.get(prestamo.id!) })) }; }
  @Get('candidatos-incobrables')
  @Roles(RolUsuario.ADMINISTRADOR)
  async candidatosIncobrables(@Query() dto: FiltrosIncobrablesDto) { const result = await this.incobrables.listarCandidatos(dto); return { ...result, datos: result.datos.map((prestamo) => ({ ...response(prestamo), fechaVencimiento: prestamo.fechaVencimiento, saldoCuota: prestamo.saldoCuota, puedePasarAIncobrable: prestamo.puedePasarAIncobrable, puedeReactivar: false })) }; }
  @Get('incobrables')
  @Roles(RolUsuario.ADMINISTRADOR)
  async incobrablesActuales(@Query() dto: FiltrosIncobrablesDto) { const result = await this.incobrables.listarIncobrables(dto); return { ...result, datos: result.datos.map((prestamo) => ({ ...response(prestamo), fechaIncobrable: prestamo.fechaIncobrable, observacionIncobrable: prestamo.observacionIncobrable, diasEnEstado: prestamo.diasEnEstado, ultimaFechaPago: prestamo.ultimaFechaPago, puedePasarAIncobrable: false, puedeReactivar: prestamo.puedeReactivar })) }; }
  @Get('candidatos-anulacion')
  @Roles(RolUsuario.ADMINISTRADOR)
  async candidatosAnulacion(@Query() dto: FiltrosPrestamosDto) { const result = await this.listarUseCase.listarCandidatosAnulacion(dto); return { ...result, datos: result.datos.map((prestamo) => ({ ...response(prestamo), puedeAnular: true })) }; }
  @Get('anulados')
  @Roles(RolUsuario.ADMINISTRADOR)
  async anulados(@Query() dto: FiltrosPrestamosDto) { const result = await this.listarUseCase.listarAnulados(dto); return { ...result, datos: result.datos.map((prestamo) => ({ ...response(prestamo), fechaAnulacion: prestamo.fechaAnulacion, observacionAnulacion: prestamo.observacionAnulacion, fechaReverso: prestamo.fechaReverso, montoReversado: prestamo.montoReversado, usuarioAnulacion: prestamo.usuarioAnulacion })) }; }
  @Get(':id/historial-estados')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
  async historialEstados(@Param('id', ParseIntPipe) id: number) { await this.obtenerUseCase.execute(id); return (await this.history.listar(id)).map(h => ({ id: h.id, estadoAnterior: h.estadoAnterior, estadoNuevo: h.estadoNuevo, fecha: h.fecha.toISOString().slice(0, 10), observacion: h.observacion, usuario: h.usuario ? { id: h.usuario.id, nombreCompleto: h.usuario.nombreCompleto } : null })); }
  @Get(':id')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
  @ApiOperation({ summary: 'Obtener un préstamo', description: 'Obtiene un préstamo por su identificador.' }) @ApiParam({ name: 'id', example: 1 }) @ApiResponse({ status: 200, type: PrestamoResponseDto }) @ApiResponse({ status: 404, description: 'Préstamo no encontrado.' })
  async obtener(@Param('id', ParseIntPipe) id: number) { const prestamo = await this.obtenerUseCase.execute(id); const cobranza = await this.cobranza.calcular([prestamo]); return { ...response(prestamo), ...cobranza.get(prestamo.id!) }; }
  @Put(':id')
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR)
  @ApiOperation({ summary: 'Actualizar un préstamo', description: 'Actualiza los datos editables de un préstamo activo.' }) @ApiParam({ name: 'id', example: 1 }) @ApiBody({ type: ActualizarPrestamoDto }) @ApiResponse({ status: 200, type: PrestamoResponseDto }) @ApiResponse({ status: 400, description: 'Datos inválidos o préstamo no activo.' }) @ApiResponse({ status: 404, description: 'Préstamo o referencia no encontrada.' })
  async actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarPrestamoDto) { return response(await this.actualizarUseCase.execute(id, dto)); }
  @Patch(':id/estado')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Cambiar estado de un préstamo', description: 'Permite únicamente ACTIVO a INCOBRABLE e INCOBRABLE a ACTIVO.' }) @ApiParam({ name: 'id', example: 1 }) @ApiBody({ type: CambiarEstadoPrestamoDto, schema: { example: { estado: EstadoPrestamo.INCOBRABLE } } }) @ApiResponse({ status: 200, type: PrestamoResponseDto }) @ApiResponse({ status: 400, description: 'Transición de estado inválida.' }) @ApiResponse({ status: 404, description: 'Préstamo no encontrado.' })
  async cambiarEstado(@Param('id', ParseIntPipe) id: number, @Body() dto: CambiarEstadoPrestamoDto, @Req() request: AuthenticatedRequest) { return response(await this.estadoUseCase.execute(id, dto, authenticatedUserId(request))); }
  @Post(':id/anular')
  @Roles(RolUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Anular un préstamo', description: 'Revierte el desembolso, conserva el préstamo y su plan, y cambia ACTIVO a ANULADO en una transacción atómica.' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ type: AnularPrestamoDto, schema: { example: { fecha: '2026-09-14', observacion: 'Desembolso registrado por error.' } } })
  @ApiResponse({ status: 200, description: 'Préstamo anulado correctamente.', type: PrestamoResponseDto })
  @ApiResponse({ status: 400, description: 'Fecha inválida o el préstamo no cumple las condiciones para anularse.' })
  @ApiResponse({ status: 403, description: 'Solo ADMINISTRADOR puede anular préstamos.' })
  @ApiResponse({ status: 409, description: 'El período está cerrado o el desembolso ya fue reversado.' })
  async anular(@Param('id', ParseIntPipe) id: number, @Body() dto: AnularPrestamoDto, @Req() request: AuthenticatedRequest) { return response(await this.anularUseCase.execute(id, dto, authenticatedUserId(request)) as any); }
}
