import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CambiarEstadoFormaPagoUseCase } from './application/use-cases/cambiar-estado-forma-pago.use-case';
import { CrearFormaPagoUseCase } from './application/use-cases/crear-forma-pago.use-case';
import { ListarFormasPagoUseCase } from './application/use-cases/listar-formas-pago.use-case';
import { ObtenerFormaPagoUseCase } from './application/use-cases/obtener-forma-pago.use-case';
import { ActualizarFormaPagoUseCase } from './application/use-cases/actualizar-forma-pago.use-case';
import { FORMA_PAGO_REPOSITORY } from './domain/repositories/forma-pago.repository';
import { FormaPagoOrmEntity } from './infrastructure/persistence/typeorm/forma-pago.orm-entity';
import { FormaPagoTypeOrmRepository } from './infrastructure/persistence/typeorm/forma-pago.typeorm-repository';
import { FormasPagoController } from './presentation/controllers/formas-pago.controller';
import { InitialFormasPagoSeed } from './application/initial-formas-pago.seed';
import { ListarFormasPagoAdministracionUseCase } from './application/use-cases/listar-formas-pago-administracion.use-case';

@Module({
  imports: [TypeOrmModule.forFeature([FormaPagoOrmEntity])],
  controllers: [FormasPagoController],
  providers: [
    CrearFormaPagoUseCase,
    ListarFormasPagoUseCase,
    ListarFormasPagoAdministracionUseCase,
    ObtenerFormaPagoUseCase,
    ActualizarFormaPagoUseCase,
    CambiarEstadoFormaPagoUseCase,
    InitialFormasPagoSeed,
    {
      provide: FORMA_PAGO_REPOSITORY,
      useClass: FormaPagoTypeOrmRepository,
    },
  ],
  exports: [FORMA_PAGO_REPOSITORY, InitialFormasPagoSeed],
})
export class FormasPagoModule {}
