import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { CrearPeriodicidadPagoUseCase } from './use-cases/crear-periodicidad-pago.use-case';
import { PERIODICIDAD_PAGO_REPOSITORY, PeriodicidadPagoRepository } from '../domain/repositories/periodicidad-pago.repository';

export const DEFAULT_PERIODICIDADES_PAGO = ['DIARIO', 'SEMANAL', 'QUINCENAL', 'MENSUAL'];

@Injectable()
export class InitialPeriodicidadesPagoSeed {
  constructor(@Inject(PERIODICIDAD_PAGO_REPOSITORY) private readonly repository: PeriodicidadPagoRepository, private readonly crear: CrearPeriodicidadPagoUseCase) {}
  async seed(): Promise<void> {
    for (const nombre of DEFAULT_PERIODICIDADES_PAGO) {
      if (await this.repository.buscarPorNombre(nombre)) continue;
      try { await this.crear.execute({ nombre }); }
      catch (error: unknown) { if (!(error instanceof ConflictException) || !(await this.repository.buscarPorNombre(nombre))) throw error; }
    }
  }
}
