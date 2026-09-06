import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PagoOrmEntity } from '../pagos/infrastructure/persistence/typeorm/pago.orm-entity';
import { PrestamosModule } from '../prestamos/prestamos.module';
import { PLAN_PAGO_REPOSITORY } from './domain/repositories/plan-pago.repository';
import { PlanPagoTypeOrmRepository } from './infrastructure/persistence/typeorm/plan-pago.typeorm-repository';
import { PlanPagoOrmEntity } from './infrastructure/persistence/typeorm/plan-pago.orm-entity';
import { ActualizarPlanPagoUseCase } from './application/use-cases/actualizar-plan-pago.use-case';
import { CrearPlanPagoPersonalizadoUseCase } from './application/use-cases/crear-plan-pago-personalizado.use-case';
import { GenerarPlanPagoUseCase } from './application/use-cases/generar-plan-pago.use-case';
import { ListarPlanPagoUseCase } from './application/use-cases/listar-plan-pago.use-case';
import { ObtenerCuotaPlanPagoUseCase } from './application/use-cases/obtener-cuota-plan-pago.use-case';
import { PlanesPagoController } from './presentation/controllers/planes-pago.controller';
import { PagosModule } from '../pagos/pagos.module';
import { PAGO_REPOSITORY } from '../pagos/domain/repositories/pago.repository';

@Module({ imports: [forwardRef(() => PrestamosModule), forwardRef(() => PagosModule), TypeOrmModule.forFeature([PlanPagoOrmEntity, PagoOrmEntity])], controllers: [PlanesPagoController], providers: [ActualizarPlanPagoUseCase, CrearPlanPagoPersonalizadoUseCase, GenerarPlanPagoUseCase, ListarPlanPagoUseCase, ObtenerCuotaPlanPagoUseCase, { provide: PLAN_PAGO_REPOSITORY, useClass: PlanPagoTypeOrmRepository }], exports: [PLAN_PAGO_REPOSITORY] })
export class PlanesPagoModule {}
