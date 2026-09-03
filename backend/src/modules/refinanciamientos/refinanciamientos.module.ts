import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrestamosModule } from '../prestamos/prestamos.module';
import { PlanesPagoModule } from '../planes-pago/planes-pago.module';
import { RefinanciamientoOrmEntity } from './infrastructure/persistence/typeorm/refinanciamiento.orm-entity';
import { RefinanciamientoTypeOrmRepository } from './infrastructure/persistence/typeorm/refinanciamiento.typeorm-repository';
import { REFINANCIAMIENTO_REPOSITORY } from './domain/repositories/refinanciamiento.repository';
import { CrearRefinanciamientoUseCase } from './application/use-cases/crear-refinanciamiento.use-case';
import { RefinanciamientoQueries } from './application/use-cases/refinanciamiento-queries.use-cases';
import { RefinanciamientosController } from './presentation/controllers/refinanciamientos.controller';
import { MovimientosCajaModule } from '../movimientos-caja/movimientos-caja.module';
@Module({ imports: [PrestamosModule, PlanesPagoModule, MovimientosCajaModule, TypeOrmModule.forFeature([RefinanciamientoOrmEntity])], controllers: [RefinanciamientosController], providers: [CrearRefinanciamientoUseCase, RefinanciamientoQueries, { provide: REFINANCIAMIENTO_REPOSITORY, useClass: RefinanciamientoTypeOrmRepository }] })
export class RefinanciamientosModule {}
