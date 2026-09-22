import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, Optional, Res } from '@nestjs/common';
import type { Response } from 'express';
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
import { AnularPagoDto } from '../../application/dto/anular-pago.dto';
import { AnularPagoUseCase } from '../../application/use-cases/anular-pago.use-case';
import { CobrosDelDiaQuery } from '../../application/dto/cobros-del-dia-query.dto';
import { ConsultarCobrosDelDiaUseCase } from '../../application/use-cases/consultar-cobros-del-dia.use-case';
import { CobrosDelDiaResponseDto } from '../dto/cobros-del-dia-response.dto';
import { ExportarPagosPdfUseCase } from '../../application/use-cases/exportar-pagos-pdf.use-case';

const dateOnly = (value: Date | string | null | undefined) => value ? (typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10)) : null;
const response = (pago: PagoConRelaciones): PagoResponseDto => ({ id: pago.id!, prestamoId: pago.prestamoId, formaPagoId: pago.formaPagoId, monto: pago.monto, capitalAplicado: pago.capitalAplicado, interesAplicado: pago.interesAplicado, cobradorId: pago.cobradorId, fecha: dateOnly(pago.fecha)!, fechaCreacion: pago.fechaCreacion, observaciones: pago.observaciones, planPagoId: pago.planPagoId ?? null, numeroPago: pago.planPago?.numeroPago ?? null, numeroCuota: pago.planPago?.numeroPago ?? null, fechaVencimiento: dateOnly(pago.planPago?.fechaVencimiento), estado: pago.estado, formaPagoNombre: pago.formaPago?.nombre ?? '', puedeAnular: pago.puedeAnular === true, anulacion: pago.anulacion ?? null, fechaAnulacion: pago.fechaAnulacion, usuarioAnulacionId: pago.usuarioAnulacionId, motivoAnulacion: pago.motivoAnulacion, observacionAnulacion: pago.observacionAnulacion, usuarioAnulacion: pago.anulacion?.usuario ?? null, formaPago: pago.formaPago, prestamo: pago.prestamo, cliente: pago.cliente, cobrador: pago.cobrador });

@ApiTags('Pagos')
@ApiBearerAuth()
@Controller('pagos')
export class PagosController {
  constructor(private readonly registrar: RegistrarPagoUseCase, private readonly listarUseCase: ListarPagosUseCase, private readonly obtener: ObtenerPagoPorIdUseCase, private readonly listarPrestamo: ListarPagosPorPrestamoUseCase, private readonly resumen: ObtenerResumenPagoPrestamoUseCase, private readonly estadoPlan: ObtenerEstadoPlanUseCase, @Optional() private readonly anular?: AnularPagoUseCase, @Optional() private readonly cobros?: ConsultarCobrosDelDiaUseCase, @Optional() private readonly exportarPdf?: ExportarPagosPdfUseCase) {}
  @Post() @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR, RolUsuario.COBRADOR) @ApiOperation({ summary: 'Registrar un pago' }) @ApiBody({ type: CrearPagoDto, schema: { example: { prestamoId: 10, planPagoId: 31, formaPagoId: 1, cobradorId: 7, monto: 24000, fecha: '2026-08-30', observaciones: 'Pago de cuota 1.' } } }) @ApiResponse({ status: 201, type: PagoResponseDto }) @ApiResponse({ status: 400, description: 'Datos inválidos, forma de pago inactiva o cobrador inactivo.' }) @ApiResponse({ status: 404, description: 'Préstamo, forma de pago o cobrador no encontrado.' })
  async crear(@Body() dto: CrearPagoDto, @Req() request: AuthenticatedRequest) { return response(await this.registrar.execute(dto, authenticatedUserId(request))); }
  @Post(':id/anular') @Roles(RolUsuario.ADMINISTRADOR) @ApiOperation({ summary: 'Anular un pago' }) @ApiParam({ name: 'id', example: 1 }) @ApiResponse({ status: 200, description: 'Pago anulado y movimiento de caja compensado.' })
  anularPago(@Param('id', ParseIntPipe) id: number, @Body() dto: AnularPagoDto, @Req() request: AuthenticatedRequest) { if (!this.anular) throw new Error('AnularPagoUseCase is not configured.'); return this.anular.execute(id, dto, authenticatedUserId(request)); }
   @Get('cobros-del-dia') @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR, RolUsuario.COBRADOR) @ApiOperation({ summary: 'Consultar cobros del día o rango de fechas', description: 'Returns active-loan obligations by due date and registered payments by payment date, including historical payments from cancelled loans. Dates are date-only and inclusive.' }) @ApiQuery({ name: 'fecha', required: false, type: String, example: '2026-09-15' }) @ApiQuery({ name: 'fechaDesde', required: false, type: String, example: '2026-09-15' }) @ApiQuery({ name: 'fechaHasta', required: false, type: String, example: '2026-09-30' }) @ApiResponse({ status: 200, type: CobrosDelDiaResponseDto })
  cobrosDelDia(@Query() query: CobrosDelDiaQuery) { if (!this.cobros) throw new Error('ConsultarCobrosDelDiaUseCase is not configured.'); return this.cobros.execute(query); }
    @Get() @Roles(RolUsuario.ADMINISTRADOR) @ApiOperation({ summary: 'Listar pagos', description: 'Filters are applied server-side before pagination. fechaDesde/fechaHasta are inclusive payment dates (pago.fecha). Totals cover the complete filtered set and always include only REGISTRADO payments, regardless of the table estado filter.' }) @ApiQuery({ name: 'pagina', required: false, type: Number, default: 1 }) @ApiQuery({ name: 'limite', required: false, type: Number, default: 10, maximum: 100 }) @ApiQuery({ name: 'formaPagoId', required: false, type: Number }) @ApiQuery({ name: 'cobradorId', required: false, type: Number }) @ApiQuery({ name: 'fechaDesde', required: false, type: String, example: '2026-09-01' }) @ApiQuery({ name: 'fechaHasta', required: false, type: String, example: '2026-09-30' }) @ApiQuery({ name: 'buscar', required: false, type: String }) @ApiQuery({ name: 'prestamoId', required: false, type: Number }) @ApiQuery({ name: 'estado', required: false, enum: ['REGISTRADO', 'ANULADO', 'TODOS'], default: 'REGISTRADO' }) @ApiResponse({ status: 200, type: PagosPaginadosResponseDto }) @ApiResponse({ status: 400, description: 'Fechas inválidas o fechaDesde posterior a fechaHasta.' })
   async listar(@Query() dto: FiltrosPagosDto) { const result = await this.listarUseCase.execute(dto); return { ...result, datos: result.datos.map(response) }; }
    @Get('exportar/pdf') @Roles(RolUsuario.ADMINISTRADOR) @ApiOperation({ summary: 'Exportar historial de pagos a PDF' }) @ApiResponse({ status: 200, description: 'PDF A4 horizontal del conjunto filtrado.' })
   async exportar(@Query() dto: FiltrosPagosDto, @Res() res: Response) { if (!this.exportarPdf) throw new Error('ExportarPagosPdfUseCase is not configured.'); const pdf = await this.exportarPdf.execute(dto); const desde = dto.fechaDesde ?? 'inicio'; const hasta = dto.fechaHasta ?? 'fin'; res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="historial-pagos-${desde}-${hasta}.pdf"` }); res.send(pdf); }
   @Get('prestamo/:prestamoId/resumen') @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR, RolUsuario.COBRADOR) @ApiOperation({ summary: 'Obtener resumen de pagos' }) @ApiParam({ name: 'prestamoId', example: 10 }) @ApiResponse({ status: 200, description: 'Capital, interés y saldos acumulados.' }) @ApiResponse({ status: 404, description: 'Préstamo no encontrado.' })
  resumenPago(@Param('prestamoId', ParseIntPipe) id: number) { return this.resumen.execute(id); }
   @Get('prestamo/:prestamoId/estado-plan') @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR, RolUsuario.COBRADOR) @ApiOperation({ summary: 'Obtener estado dinámico del plan' }) @ApiParam({ name: 'prestamoId', example: 10 }) @ApiQuery({ name: 'fecha', required: false, type: String, example: '2026-08-30', description: 'Fecha de análisis estricta y calendario válida en formato YYYY-MM-DD.' }) @ApiResponse({ status: 200, description: 'Estado calculado sin modificar el plan.', type: EstadoPlanResponseDto }) @ApiResponse({ status: 400, description: 'Fecha inválida.' }) @ApiResponse({ status: 404, description: 'Préstamo o plan de pago no encontrado.' })
  estado(@Param('prestamoId', ParseIntPipe) id: number, @Query() query: EstadoPlanQueryDto) { return this.estadoPlan.execute(id, query); }
   @Get('prestamo/:prestamoId') @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR, RolUsuario.COBRADOR) @ApiOperation({ summary: 'Listar pagos de un préstamo' }) @ApiParam({ name: 'prestamoId', example: 10 })
  async listarPorPrestamo(@Param('prestamoId', ParseIntPipe) id: number) { return (await this.listarPrestamo.execute(id)).map(response); }
   @Get(':id') @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR, RolUsuario.COBRADOR) @ApiOperation({ summary: 'Obtener un pago' }) @ApiParam({ name: 'id', example: 1 }) @ApiResponse({ status: 200, type: PagoResponseDto }) @ApiResponse({ status: 404, description: 'Pago no encontrado.' })
  async obtenerPorId(@Param('id', ParseIntPipe) id: number) { return response(await this.obtener.execute(id)); }
}
