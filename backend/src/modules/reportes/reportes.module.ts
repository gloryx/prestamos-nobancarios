import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MovimientoCajaOrmEntity } from '../movimientos-caja/infrastructure/persistence/typeorm/movimiento-caja.orm-entity';
import { PagoOrmEntity } from '../pagos/infrastructure/persistence/typeorm/pago.orm-entity';
import { FLUJO_PRESTAMOS_REPOSITORY } from './domain/repositories/flujo-prestamos.repository';
import { FlujoPrestamosTypeOrmRepository } from './infrastructure/flujo-prestamos.typeorm-repository';
import { FlujoPrestamosUseCase } from './application/flujo-prestamos.use-case';
import { FlujoPrestamosController } from './presentation/flujo-prestamos.controller';
@Module({ imports: [TypeOrmModule.forFeature([PagoOrmEntity, MovimientoCajaOrmEntity])], controllers: [FlujoPrestamosController], providers: [FlujoPrestamosUseCase, { provide: FLUJO_PRESTAMOS_REPOSITORY, useClass: FlujoPrestamosTypeOrmRepository }] })
export class ReportesModule {}
