import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { InitialPeriodicidadesPagoSeed } from '../modules/periodicidades-pago/application/initial-periodicidades-pago.seed';
import { InitialFormasPagoSeed } from '../modules/formas-pago/application/initial-formas-pago.seed';
import { InitialIngresosSeed } from '../modules/ingresos/application/initial-ingresos.seed';
import { InitialAdminSeed } from '../modules/usuarios/application/initial-admin.seed';

async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    await app.get(InitialPeriodicidadesPagoSeed).seed();
    await app.get(InitialFormasPagoSeed).seed();
    await app.get(InitialIngresosSeed).seed();
    await app.get(InitialAdminSeed).seed();
  } finally {
    await app.close();
  }
}

void seed().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
