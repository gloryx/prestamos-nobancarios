import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { UsuarioOrmEntity } from '../modules/usuarios/infrastructure/persistence/typeorm/usuario.orm-entity';
import { ClienteOrmEntity } from '../modules/clientes/infrastructure/persistence/typeorm/cliente.orm-entity';
import { FormaPagoOrmEntity } from '../modules/formas-pago/infrastructure/persistence/typeorm/forma-pago.orm-entity';
import { PeriodicidadPagoOrmEntity } from '../modules/periodicidades-pago/infrastructure/persistence/typeorm/periodicidad-pago.orm-entity';
import { PrestamoOrmEntity } from '../modules/prestamos/infrastructure/persistence/typeorm/prestamo.orm-entity';
import { PrestamoEstadoHistorialOrmEntity } from '../modules/prestamos/infrastructure/persistence/typeorm/prestamo-estado-historial.orm-entity';
import { PlanPagoOrmEntity } from '../modules/planes-pago/infrastructure/persistence/typeorm/plan-pago.orm-entity';
import { PagoOrmEntity } from '../modules/pagos/infrastructure/persistence/typeorm/pago.orm-entity';
import { PagoAnulacionOrmEntity } from '../modules/pagos/infrastructure/persistence/typeorm/pago-anulacion.orm-entity';
import { RefinanciamientoOrmEntity } from '../modules/refinanciamientos/infrastructure/persistence/typeorm/refinanciamiento.orm-entity';
import { MovimientoCajaOrmEntity } from '../modules/movimientos-caja/infrastructure/persistence/typeorm/movimiento-caja.orm-entity';
import { ConfiguracionFinancieraOrmEntity, CierreMensualOrmEntity, DetalleCorteMensualOrmEntity } from '../modules/cierre-financiero/domain/financial.orm-entities';
import { FuenteIngresoOrmEntity } from '../modules/ingresos/infrastructure/persistence/typeorm/fuente-ingreso.orm-entity';
import { IngresoOrmEntity } from '../modules/ingresos/infrastructure/persistence/typeorm/ingreso.orm-entity';

config();

const required = (name: string): string => {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`${name} is required for TypeORM CLI.`);
  return value;
};

export default new DataSource({
  type: 'postgres',
  host: required('DB_HOST'),
  port: Number(process.env.DB_PORT ?? 5432),
  username: required('DB_USERNAME'),
  password: process.env.DB_PASSWORD ?? '',
  database: required('DB_DATABASE'),
  entities: [
    UsuarioOrmEntity, ClienteOrmEntity, FormaPagoOrmEntity, PeriodicidadPagoOrmEntity,
    PrestamoOrmEntity, PrestamoEstadoHistorialOrmEntity, PlanPagoOrmEntity, PagoOrmEntity, PagoAnulacionOrmEntity,
    RefinanciamientoOrmEntity, MovimientoCajaOrmEntity, ConfiguracionFinancieraOrmEntity,
    CierreMensualOrmEntity, DetalleCorteMensualOrmEntity, FuenteIngresoOrmEntity, IngresoOrmEntity,
  ],
  migrations: [__dirname + '/migrations/*.{js,ts}'],
  synchronize: false,
});
