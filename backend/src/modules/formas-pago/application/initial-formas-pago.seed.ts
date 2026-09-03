import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { CrearFormaPagoUseCase } from './use-cases/crear-forma-pago.use-case';
import { FORMA_PAGO_REPOSITORY, FormaPagoRepository } from '../domain/repositories/forma-pago.repository';

export const DEFAULT_FORMAS_PAGO = ['SINPE MÓVIL', 'TRANSFERENCIA', 'EFECTIVO', 'TARJETA', 'OTRO'];

@Injectable()
export class InitialFormasPagoSeed {
  constructor(@Inject(FORMA_PAGO_REPOSITORY) private readonly repository: FormaPagoRepository, private readonly crear: CrearFormaPagoUseCase) {}
  async seed(): Promise<void> {
    for (const nombre of DEFAULT_FORMAS_PAGO) {
      if (await this.repository.buscarPorNombre(nombre)) continue;
      try { await this.crear.execute({ nombre }); }
      catch (error: unknown) { if (!(error instanceof ConflictException) || !(await this.repository.buscarPorNombre(nombre))) throw error; }
    }
  }
}
