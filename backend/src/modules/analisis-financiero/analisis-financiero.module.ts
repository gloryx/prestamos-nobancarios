import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MovimientoCajaOrmEntity } from '../movimientos-caja/infrastructure/persistence/typeorm/movimiento-caja.orm-entity';
import { PagoOrmEntity } from '../pagos/infrastructure/persistence/typeorm/pago.orm-entity';
import { PrestamoOrmEntity } from '../prestamos/infrastructure/persistence/typeorm/prestamo.orm-entity';
import { PlanPagoOrmEntity } from '../planes-pago/infrastructure/persistence/typeorm/plan-pago.orm-entity';
import { ANALISIS_FINANCIERO_REPOSITORY } from './domain/repositories/analisis-financiero.repository';
import { AnalisisFinancieroTypeOrmRepository } from './infrastructure/analisis-financiero.typeorm-repository';
import { AnalisisFinancieroUseCase } from './application/analisis-financiero.use-case';
import { AnalisisFinancieroController } from './presentation/analisis-financiero.controller';

@Module({ imports: [TypeOrmModule.forFeature([PagoOrmEntity, MovimientoCajaOrmEntity, PrestamoOrmEntity, PlanPagoOrmEntity])], controllers: [AnalisisFinancieroController], providers: [AnalisisFinancieroUseCase, { provide: ANALISIS_FINANCIERO_REPOSITORY, useClass: AnalisisFinancieroTypeOrmRepository }] })
export class AnalisisFinancieroModule {}
