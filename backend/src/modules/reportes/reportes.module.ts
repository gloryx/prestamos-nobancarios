import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MovimientoCajaOrmEntity } from '../movimientos-caja/infrastructure/persistence/typeorm/movimiento-caja.orm-entity';
import { PagoOrmEntity } from '../pagos/infrastructure/persistence/typeorm/pago.orm-entity';
import { FLUJO_PRESTAMOS_REPOSITORY } from './domain/repositories/flujo-prestamos.repository';
import { FlujoPrestamosTypeOrmRepository } from './infrastructure/flujo-prestamos.typeorm-repository';
import { FlujoPrestamosUseCase } from './application/flujo-prestamos.use-case';
import { FlujoPrestamosController } from './presentation/flujo-prestamos.controller';
import { EstadisticasClientesController } from './presentation/estadisticas-clientes.controller';
import { EstadisticasClientesUseCase } from './application/estadisticas-clientes.use-case';
import { ESTADISTICAS_CLIENTES_REPOSITORY } from './domain/repositories/estadisticas-clientes.repository';
import { EstadisticasClientesTypeOrmRepository } from './infrastructure/estadisticas-clientes.typeorm-repository';
@Module({ imports: [TypeOrmModule.forFeature([PagoOrmEntity, MovimientoCajaOrmEntity])], controllers: [FlujoPrestamosController, EstadisticasClientesController], providers: [FlujoPrestamosUseCase, EstadisticasClientesUseCase, { provide: FLUJO_PRESTAMOS_REPOSITORY, useClass: FlujoPrestamosTypeOrmRepository }, { provide: ESTADISTICAS_CLIENTES_REPOSITORY, useClass: EstadisticasClientesTypeOrmRepository }] })
export class ReportesModule {}
