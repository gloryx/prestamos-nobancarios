import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfiguracionFinancieraOrmEntity, CierreMensualOrmEntity, DetalleCorteMensualOrmEntity } from './domain/financial.orm-entities';
import { FinancialPeriodService } from './application/financial-period.service';
import { ConfiguracionFinancieraController, CortesMensualesController } from './presentation/cierre-financiero.controller';
import { PrestamoEstadoHistorialModule } from '../prestamos/prestamo-estado-historial.module';
import { PUESTA_EN_MARCHA_REPOSITORY } from './domain/repositories/puesta-en-marcha.repository';
import { PuestaEnMarchaTypeOrmRepository } from './infrastructure/persistence/typeorm/puesta-en-marcha.typeorm-repository';
import { PuestaMarchaFinancieraOrmEntity, PuestaMarchaFinancieraSaldoOrmEntity } from './infrastructure/persistence/typeorm/puesta-en-marcha.orm-entities';
@Global()
@Module({ imports: [PrestamoEstadoHistorialModule, TypeOrmModule.forFeature([ConfiguracionFinancieraOrmEntity, CierreMensualOrmEntity, DetalleCorteMensualOrmEntity, PuestaMarchaFinancieraOrmEntity, PuestaMarchaFinancieraSaldoOrmEntity])], controllers: [ConfiguracionFinancieraController, CortesMensualesController], providers: [FinancialPeriodService, { provide: PUESTA_EN_MARCHA_REPOSITORY, useClass: PuestaEnMarchaTypeOrmRepository }], exports: [FinancialPeriodService, PUESTA_EN_MARCHA_REPOSITORY] })
export class CierreFinancieroModule {}
