import { Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Inject } from '@nestjs/common';
import { CrearMovimientoCajaDto } from '../../application/dto/crear-movimiento-caja.dto';
import { FiltrosMovimientosCajaDto } from '../../application/dto/filtros-movimientos-caja.dto';
import { ReversarMovimientoCajaDto } from '../../application/dto/reversar-movimiento-caja.dto';
import { MovimientoCajaService } from '../../application/services/movimiento-caja.service';
import { MOVIMIENTO_CAJA_REPOSITORY, MovimientoCajaRepository } from '../../domain/repositories/movimiento-caja.repository';
import { authenticatedUserId, AuthenticatedRequest } from '../../../../common/authenticated-user';
import { ConceptoMovimientoCaja } from '../../domain/enums/concepto-movimiento-caja.enum';
import { TipoMovimientoCaja } from '../../domain/enums/tipo-movimiento-caja.enum';
import { Roles } from '../../../auth/auth.decorators';
import { RolUsuario } from '../../../usuarios/domain/enums/rol-usuario.enum';

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

@ApiTags('Movimientos de caja')
@ApiBearerAuth()
@Controller('movimientos-caja')
@Roles(RolUsuario.ADMINISTRADOR)
export class MovimientosCajaController {
  constructor(@InjectDataSource() private readonly db: DataSource, private readonly service: MovimientoCajaService, @Inject(MOVIMIENTO_CAJA_REPOSITORY) private readonly repo: MovimientoCajaRepository) {}
  @Post() @ApiOperation({ summary: 'Registrar movimiento manual', description: 'Registra dinero real que entra o sale de caja; no representa capital o interés contable.' }) @ApiResponse({ status: 201 }) @ApiResponse({ status: 400, description: 'Concepto automático o datos inválidos.' })
  crear(@Body() dto: CrearMovimientoCajaDto, @Req() request: AuthenticatedRequest) { return this.db.transaction(manager => this.service.crearManual(manager, { ...dto, fecha: date(dto.fecha), usuarioId: authenticatedUserId(request) })); }
  @Post(':id/reversar') @ApiOperation({ summary: 'Reversar movimiento sin mutar el original' }) @ApiParam({ name: 'id', type: Number }) @ApiResponse({ status: 404, description: 'Movimiento no encontrado.' }) @ApiResponse({ status: 409, description: 'Movimiento ya reversado.' })
  reversar(@Param('id', ParseIntPipe) id: number, @Body() dto: ReversarMovimientoCajaDto, @Req() request: AuthenticatedRequest) { return this.db.transaction(manager => this.service.reversar(manager, id, date(dto.fecha), dto.observaciones.trim(), authenticatedUserId(request))); }
  @Get() @ApiOperation({ summary: 'Listar movimientos de caja', description: 'Ordenado por fecha económica descendente e identificador descendente. Los filtros se aplican sobre los movimientos registrados, incluyendo sus referencias y rango de fecha inclusivo.' }) @ApiQuery({ name: 'buscar', required: false, type: String }) @ApiQuery({ name: 'pagina', required: false, type: Number, minimum: 1 }) @ApiQuery({ name: 'limite', required: false, type: Number, minimum: 1, maximum: 100 }) @ApiQuery({ name: 'tipo', required: false, enum: ['ENTRADA', 'SALIDA'] }) @ApiQuery({ name: 'concepto', required: false, enum: ['PAGO_CLIENTE', 'DESEMBOLSO_PRESTAMO', 'DESEMBOLSO_REFINANCIAMIENTO', 'APORTE_CAPITAL', 'RETIRO', 'GASTO', 'AJUSTE_ENTRADA', 'AJUSTE_SALIDA', 'REVERSO'] }) @ApiQuery({ name: 'usuarioId', required: false, type: Number }) @ApiQuery({ name: 'pagoId', required: false, type: Number }) @ApiQuery({ name: 'prestamoId', required: false, type: Number }) @ApiQuery({ name: 'refinanciamientoId', required: false, type: Number }) @ApiQuery({ name: 'fechaDesde', required: false, type: String }) @ApiQuery({ name: 'fechaHasta', required: false, type: String }) listar(@Query() dto: FiltrosMovimientosCajaDto) { return this.repo.listar(dto); }
  @Get('resumen') @ApiOperation({ summary: 'Resumen bruto de dinero real de caja', description: 'Suma los montos registrados en caja, agrupados por concepto y dirección económica. fechaDesde y fechaHasta son inclusivas. No representa capital, interés, saldo de préstamos ni estados contables; no sustituye esos cálculos.' }) @ApiQuery({ name: 'fechaDesde', required: false, type: String, description: 'Fecha económica inicial inclusiva (YYYY-MM-DD).' }) @ApiQuery({ name: 'fechaHasta', required: false, type: String, description: 'Fecha económica final inclusiva (YYYY-MM-DD).' }) @ApiQuery({ name: 'tipo', required: false, enum: TipoMovimientoCaja, description: 'Filtra por dirección económica: ENTRADA o SALIDA.' }) @ApiQuery({ name: 'concepto', required: false, enum: ConceptoMovimientoCaja, description: 'Filtra por concepto registrado.' }) resumen(@Query() dto: FiltrosMovimientosCajaDto) { return this.repo.calcularTotales(dto); }
  @Get(':id') @ApiOperation({ summary: 'Detalle de movimiento y relaciones' }) @ApiResponse({ status: 404, type: Object }) async detalle(@Param('id', ParseIntPipe) id: number) { const value = await this.repo.buscarPorId(id); if (!value) throw new NotFoundException('Movimiento de caja no encontrado.'); return value; }
}
