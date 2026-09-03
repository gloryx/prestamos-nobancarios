import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormasPagoModule } from '../formas-pago/formas-pago.module';
import { PrestamosModule } from '../prestamos/prestamos.module';
import { PlanesPagoModule } from '../planes-pago/planes-pago.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { MovimientosCajaModule } from '../movimientos-caja/movimientos-caja.module';
import { PAGO_REPOSITORY } from './domain/repositories/pago.repository';
import { PagoTypeOrmRepository } from './infrastructure/persistence/typeorm/pago.typeorm-repository';
import { PagoOrmEntity } from './infrastructure/persistence/typeorm/pago.orm-entity';
import { PagosController } from './presentation/controllers/pagos.controller';
import { RegistrarPagoUseCase } from './application/use-cases/registrar-pago.use-case';
import { ListarPagosUseCase } from './application/use-cases/listar-pagos.use-case';
import { ObtenerPagoPorIdUseCase } from './application/use-cases/obtener-pago-por-id.use-case';
import { ListarPagosPorPrestamoUseCase } from './application/use-cases/listar-pagos-por-prestamo.use-case';
import { ObtenerResumenPagoPrestamoUseCase } from './application/use-cases/obtener-resumen-pago-prestamo.use-case';
import { ObtenerEstadoPlanUseCase } from './application/use-cases/obtener-estado-plan.use-case';

@Module({ imports:  [
  FormasPagoModule,
  forwardRef(() => PrestamosModule),
  UsuariosModule,
  MovimientosCajaModule,
  forwardRef(() => PlanesPagoModule),
  TypeOrmModule.forFeature([PagoOrmEntity]),
], controllers: [PagosController], providers: [RegistrarPagoUseCase, ListarPagosUseCase, ObtenerPagoPorIdUseCase, ListarPagosPorPrestamoUseCase, ObtenerResumenPagoPrestamoUseCase, ObtenerEstadoPlanUseCase, { provide: PAGO_REPOSITORY, useClass: PagoTypeOrmRepository }], exports: [PAGO_REPOSITORY] })
export class PagosModule {}
