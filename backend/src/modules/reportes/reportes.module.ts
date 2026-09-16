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
import { DESEMPENO_COBRADORES_REPOSITORY } from './domain/repositories/desempeno-cobradores.repository';
import { DesempenoCobradoresTypeOrmRepository } from './infrastructure/desempeno-cobradores.typeorm-repository';
import { DesempenoCobradoresUseCase } from './application/desempeno-cobradores.use-case';
import { DesempenoCobradoresController } from './presentation/desempeno-cobradores.controller';
import { DesempenoCobradoresPdfService } from './infrastructure/desempeno-cobradores-pdf.service';
import { ExportarDesempenoCobradoresPdfUseCase } from './application/exportar-desempeno-cobradores-pdf.use-case';
@Module({ imports: [TypeOrmModule.forFeature([PagoOrmEntity, MovimientoCajaOrmEntity])], controllers: [FlujoPrestamosController, EstadisticasClientesController, DesempenoCobradoresController], providers: [FlujoPrestamosUseCase, EstadisticasClientesUseCase, DesempenoCobradoresUseCase, ExportarDesempenoCobradoresPdfUseCase, DesempenoCobradoresPdfService, { provide: FLUJO_PRESTAMOS_REPOSITORY, useClass: FlujoPrestamosTypeOrmRepository }, { provide: ESTADISTICAS_CLIENTES_REPOSITORY, useClass: EstadisticasClientesTypeOrmRepository }, { provide: DESEMPENO_COBRADORES_REPOSITORY, useClass: DesempenoCobradoresTypeOrmRepository }] })
export class ReportesModule {}
