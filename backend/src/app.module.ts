import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormasPagoModule } from './modules/formas-pago/formas-pago.module';
import { PeriodicidadesPagoModule } from './modules/periodicidades-pago/periodicidades-pago.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { PrestamosModule } from './modules/prestamos/prestamos.module';
import { PlanesPagoModule } from './modules/planes-pago/planes-pago.module';
import { PagosModule } from './modules/pagos/pagos.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { RefinanciamientosModule } from './modules/refinanciamientos/refinanciamientos.module';
import { MovimientosCajaModule } from './modules/movimientos-caja/movimientos-caja.module';
import { AuthModule } from './modules/auth/auth.module';
import { CierreFinancieroModule } from './modules/cierre-financiero/cierre-financiero.module';
import { IngresosModule } from './modules/ingresos/ingresos.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: (config) => { if (!config.JWT_SECRET?.trim()) throw new Error('JWT_SECRET es obligatorio y no puede estar vacío.'); if (!config.JWT_EXPIRES_IN?.trim()) throw new Error('JWT_EXPIRES_IN es obligatorio y no puede estar vacío.'); return config; } }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: Number(configService.get<string>('DB_PORT')),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD') ?? '',
        database: configService.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    FormasPagoModule,
    PeriodicidadesPagoModule,
    ClientesModule,
    PrestamosModule,
    PlanesPagoModule,
    PagosModule,
    UsuariosModule,
    RefinanciamientosModule,
    MovimientosCajaModule,
    AuthModule,
    CierreFinancieroModule,
    IngresosModule,
  ],
})
export class AppModule {}
