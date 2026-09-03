import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfiguracionFinancieraOrmEntity, CierreMensualOrmEntity, DetalleCorteMensualOrmEntity } from './domain/financial.orm-entities';
import { FinancialPeriodService } from './application/financial-period.service';
import { ConfiguracionFinancieraController, CortesMensualesController } from './presentation/cierre-financiero.controller';
import { PrestamoEstadoHistorialModule } from '../prestamos/prestamo-estado-historial.module';
@Global()
@Module({ imports: [PrestamoEstadoHistorialModule, TypeOrmModule.forFeature([ConfiguracionFinancieraOrmEntity, CierreMensualOrmEntity, DetalleCorteMensualOrmEntity])], controllers: [ConfiguracionFinancieraController, CortesMensualesController], providers: [FinancialPeriodService], exports: [FinancialPeriodService] })
export class CierreFinancieroModule {}
