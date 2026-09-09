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
import { PrevisualizarRefinanciamientoUseCase } from './application/use-cases/previsualizar-refinanciamiento.use-case';
import { ObtenerCadenasClienteUseCase } from './application/use-cases/obtener-cadenas-cliente.use-case';
import { PrestamoOrmEntity } from '../prestamos/infrastructure/persistence/typeorm/prestamo.orm-entity';
import { ClienteOrmEntity } from '../clientes/infrastructure/persistence/typeorm/cliente.orm-entity';
@Module({ imports: [PrestamosModule, PlanesPagoModule, MovimientosCajaModule, TypeOrmModule.forFeature([RefinanciamientoOrmEntity, PrestamoOrmEntity, ClienteOrmEntity])], controllers: [RefinanciamientosController], providers: [CrearRefinanciamientoUseCase, PrevisualizarRefinanciamientoUseCase, ObtenerCadenasClienteUseCase, RefinanciamientoQueries, { provide: REFINANCIAMIENTO_REPOSITORY, useClass: RefinanciamientoTypeOrmRepository }] })
export class RefinanciamientosModule {}
