import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActualizarPeriodicidadPagoUseCase } from './application/use-cases/actualizar-periodicidad-pago.use-case';
import { CambiarEstadoPeriodicidadPagoUseCase } from './application/use-cases/cambiar-estado-periodicidad-pago.use-case';
import { CrearPeriodicidadPagoUseCase } from './application/use-cases/crear-periodicidad-pago.use-case';
import { ListarPeriodicidadesPagoUseCase } from './application/use-cases/listar-periodicidades-pago.use-case';
import { ObtenerPeriodicidadPagoUseCase } from './application/use-cases/obtener-periodicidad-pago.use-case';
import { PERIODICIDAD_PAGO_REPOSITORY } from './domain/repositories/periodicidad-pago.repository';
import { PeriodicidadPagoTypeOrmRepository } from './infrastructure/persistence/typeorm/periodicidad-pago.typeorm-repository';
import { PeriodicidadPagoOrmEntity } from './infrastructure/persistence/typeorm/periodicidad-pago.orm-entity';
import { PeriodicidadesPagoController } from './presentation/controllers/periodicidades-pago.controller';
import { InitialPeriodicidadesPagoSeed } from './application/initial-periodicidades-pago.seed';

@Module({
  imports: [TypeOrmModule.forFeature([PeriodicidadPagoOrmEntity])],
  controllers: [PeriodicidadesPagoController],
  providers: [
    CrearPeriodicidadPagoUseCase,
    ListarPeriodicidadesPagoUseCase,
    ObtenerPeriodicidadPagoUseCase,
    ActualizarPeriodicidadPagoUseCase,
    CambiarEstadoPeriodicidadPagoUseCase,
    { provide: PERIODICIDAD_PAGO_REPOSITORY, useClass: PeriodicidadPagoTypeOrmRepository },
    InitialPeriodicidadesPagoSeed,
  ],
  exports: [PERIODICIDAD_PAGO_REPOSITORY, InitialPeriodicidadesPagoSeed],
})
export class PeriodicidadesPagoModule {}
