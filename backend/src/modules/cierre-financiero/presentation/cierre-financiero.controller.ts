import { Body, ConflictException, Controller, Get, NotFoundException, Param, ParseIntPipe, Post, Query, Req } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../auth/auth.decorators';
import { RolUsuario } from '../../usuarios/domain/enums/rol-usuario.enum';
import { authenticatedUserId, AuthenticatedRequest } from '../../../common/authenticated-user';
import { ConfigurarFinanzasDto } from '../application/dto/configurar-finanzas.dto';
import { PeriodoDto } from '../application/dto/periodo.dto';
import { FinancialPeriodService } from '../application/financial-period.service';
import { CierreMensualOrmEntity, ConfiguracionFinancieraOrmEntity, DetalleCorteMensualOrmEntity } from '../domain/financial.orm-entities';

@Controller('configuracion-financiera')
@ApiBearerAuth()
export class ConfiguracionFinancieraController {
  constructor(@InjectDataSource() private readonly db: DataSource, private readonly service: FinancialPeriodService) {}
  @Get() async get() { const config = await this.db.getRepository(ConfiguracionFinancieraOrmEntity).findOne({ where: { singletonKey: 'FINANCIERA' } }); if (!config) return null; const { usuarioAperturaId, singletonKey, ...safe } = config; return safe; }
  @Get('vista-previa') preview(@Query('fecha') fecha: string) { this.service.assertDate(fecha); return this.db.transaction(m => this.service.openingSnapshot(m, fecha)); }
  @Post() @Roles(RolUsuario.ADMINISTRADOR)
  create(@Body() dto: ConfigurarFinanzasDto, @Req() req: AuthenticatedRequest) { this.service.assertDate(dto.fechaApertura); return this.db.transaction(async manager => { if (await this.service.config(manager)) throw new ConflictException('La configuración financiera ya existe.'); const snapshot = await this.service.openingSnapshot(manager, dto.fechaApertura); return manager.getRepository(ConfiguracionFinancieraOrmEntity).save({ id: 1, singletonKey: 'FINANCIERA', fechaApertura: dto.fechaApertura, carteraInicial: snapshot.carteraTotal, carteraActivaInicial: snapshot.carteraActiva, carteraIncobrableInicial: snapshot.carteraIncobrable, disponibleInicial: dto.disponibleInicial, capitalSemillaHistorico: dto.capitalSemillaHistorico ?? null, observaciones: dto.observaciones?.trim() || null, usuarioAperturaId: authenticatedUserId(req) }); }); }
}

@Controller('cortes-mensuales')
@ApiBearerAuth()
export class CortesMensualesController {
  constructor(@InjectDataSource() private readonly db: DataSource, private readonly service: FinancialPeriodService) {}
  @Get('vista-previa') preview(@Query() dto: PeriodoDto) { return this.db.transaction(m => this.service.previewClose(m, dto.anio, dto.mes)); }
  @Post('cerrar') @Roles(RolUsuario.ADMINISTRADOR) close(@Body() dto: PeriodoDto, @Req() req: AuthenticatedRequest) { return this.db.transaction(m => this.service.close(m, dto.anio, dto.mes, authenticatedUserId(req), dto.observaciones)); }
  @Get() list() { return this.db.getRepository(CierreMensualOrmEntity).find({ order: { fechaInicio: 'ASC' } }); }
  @Get(':id') async get(@Param('id', ParseIntPipe) id: number) { const close = await this.db.getRepository(CierreMensualOrmEntity).findOne({ where: { id } }); if (!close) throw new NotFoundException('Corte mensual no encontrado.'); const detalles = await this.db.getRepository(DetalleCorteMensualOrmEntity).find({ where: { corteId: id }, order: { id: 'ASC' } }); return { ...close, detalles }; }
}
