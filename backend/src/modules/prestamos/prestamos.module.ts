import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormasPagoModule } from '../formas-pago/formas-pago.module';
import { PeriodicidadesPagoModule } from '../periodicidades-pago/periodicidades-pago.module';
import { ClientesModule } from '../clientes/clientes.module';
import { ActualizarPrestamoUseCase } from './application/use-cases/actualizar-prestamo.use-case';
import { CambiarEstadoPrestamoUseCase } from './application/use-cases/cambiar-estado-prestamo.use-case';
import { CrearPrestamoUseCase } from './application/use-cases/crear-prestamo.use-case';
import { ListarPrestamosUseCase } from './application/use-cases/listar-prestamos.use-case';
import { ResumirPrestamosUseCase } from './application/use-cases/resumir-prestamos.use-case';
import { ObtenerPrestamoPorIdUseCase } from './application/use-cases/obtener-prestamo-por-id.use-case';
import { PrestamoReferences } from './application/use-cases/prestamo-references';
import { PRESTAMO_REPOSITORY } from './domain/repositories/prestamo.repository';
import { PrestamoTypeOrmRepository } from './infrastructure/persistence/typeorm/prestamo.typeorm-repository';
import { PrestamoOrmEntity } from './infrastructure/persistence/typeorm/prestamo.orm-entity';
import { PrestamosController } from './presentation/controllers/prestamos.controller';
import { MovimientosCajaModule } from '../movimientos-caja/movimientos-caja.module';
import { PlanesPagoModule } from '../planes-pago/planes-pago.module';
import { PagosModule } from '../pagos/pagos.module';
import { PrestamoEstadoHistorialModule } from './prestamo-estado-historial.module';
import { PrestamoEstadoHistorialOrmEntity } from './infrastructure/persistence/typeorm/prestamo-estado-historial.orm-entity';
import { PlanPagoPdfService } from './application/services/plan-pago-pdf.service';
import { PlanPagoPdfInfrastructureService } from './infrastructure/reports/plan-pago-pdf.infrastructure-service';
import { PagoOrmEntity } from '../pagos/infrastructure/persistence/typeorm/pago.orm-entity';
import { PlanPagoOrmEntity } from '../planes-pago/infrastructure/persistence/typeorm/plan-pago.orm-entity';
import { IndicadorCobranzaService } from './application/services/indicador-cobranza.service';
import { ExportarPrestamosExcelUseCase } from './application/use-cases/exportar-prestamos-excel.use-case';
import { PrestamosExcelGenerator } from './infrastructure/reports/prestamos-excel.generator';

@Module({
  imports: [ClientesModule, PeriodicidadesPagoModule, FormasPagoModule, MovimientosCajaModule, forwardRef(() => PlanesPagoModule), forwardRef(() => PagosModule), PrestamoEstadoHistorialModule, TypeOrmModule.forFeature([PrestamoOrmEntity, PrestamoEstadoHistorialOrmEntity, PagoOrmEntity, PlanPagoOrmEntity])],
  controllers: [PrestamosController],
  providers: [CrearPrestamoUseCase, ListarPrestamosUseCase, ResumirPrestamosUseCase, ExportarPrestamosExcelUseCase, PrestamosExcelGenerator, ObtenerPrestamoPorIdUseCase, ActualizarPrestamoUseCase, CambiarEstadoPrestamoUseCase, PlanPagoPdfService, PlanPagoPdfInfrastructureService, PrestamoReferences, IndicadorCobranzaService, { provide: PRESTAMO_REPOSITORY, useClass: PrestamoTypeOrmRepository }],
  exports: [PRESTAMO_REPOSITORY],
})
export class PrestamosModule {}
