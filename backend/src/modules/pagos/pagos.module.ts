import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormasPagoModule } from '../formas-pago/formas-pago.module';
import { PrestamosModule } from '../prestamos/prestamos.module';
import { PrestamoEstadoHistorialModule } from '../prestamos/prestamo-estado-historial.module';
import { PlanesPagoModule } from '../planes-pago/planes-pago.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { MovimientosCajaModule } from '../movimientos-caja/movimientos-caja.module';
import { PAGO_REPOSITORY } from './domain/repositories/pago.repository';
import { PagoTypeOrmRepository } from './infrastructure/persistence/typeorm/pago.typeorm-repository';
import { PagoOrmEntity } from './infrastructure/persistence/typeorm/pago.orm-entity';
import { PagoAnulacionOrmEntity } from './infrastructure/persistence/typeorm/pago-anulacion.orm-entity';
import { PagoAnulacionTypeOrmRepository } from './infrastructure/persistence/typeorm/pago-anulacion.typeorm-repository';
import { PAGO_ANULACION_REPOSITORY } from './domain/repositories/pago-anulacion.repository';
import { PagosController } from './presentation/controllers/pagos.controller';
import { RegistrarPagoUseCase } from './application/use-cases/registrar-pago.use-case';
import { ListarPagosUseCase } from './application/use-cases/listar-pagos.use-case';
import { ObtenerPagoPorIdUseCase } from './application/use-cases/obtener-pago-por-id.use-case';
import { ListarPagosPorPrestamoUseCase } from './application/use-cases/listar-pagos-por-prestamo.use-case';
import { ObtenerResumenPagoPrestamoUseCase } from './application/use-cases/obtener-resumen-pago-prestamo.use-case';
import { ObtenerEstadoPlanUseCase } from './application/use-cases/obtener-estado-plan.use-case';
import { AnularPagoUseCase } from './application/use-cases/anular-pago.use-case';

@Module({ imports:  [
  FormasPagoModule,
  forwardRef(() => PrestamosModule),
  PrestamoEstadoHistorialModule,
  UsuariosModule,
  MovimientosCajaModule,
  forwardRef(() => PlanesPagoModule),
  TypeOrmModule.forFeature([PagoOrmEntity, PagoAnulacionOrmEntity]),
], controllers: [PagosController], providers: [RegistrarPagoUseCase, ListarPagosUseCase, ObtenerPagoPorIdUseCase, ListarPagosPorPrestamoUseCase, ObtenerResumenPagoPrestamoUseCase, ObtenerEstadoPlanUseCase, AnularPagoUseCase, { provide: PAGO_REPOSITORY, useClass: PagoTypeOrmRepository }, { provide: PAGO_ANULACION_REPOSITORY, useClass: PagoAnulacionTypeOrmRepository }], exports: [PAGO_REPOSITORY] })
export class PagosModule {}
