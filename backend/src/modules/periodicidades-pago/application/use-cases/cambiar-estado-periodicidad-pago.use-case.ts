import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PeriodicidadPago } from '../../domain/entities/periodicidad-pago';
import {
  PERIODICIDAD_PAGO_REPOSITORY,
  PeriodicidadPagoRepository,
} from '../../domain/repositories/periodicidad-pago.repository';

@Injectable()
export class CambiarEstadoPeriodicidadPagoUseCase {
  constructor(
    @Inject(PERIODICIDAD_PAGO_REPOSITORY)
    private readonly repository: PeriodicidadPagoRepository,
  ) {}

  async execute(id: number, activo: boolean): Promise<PeriodicidadPago> {
    const periodicidadPago = await this.repository.buscarPorId(id);
    if (!periodicidadPago) {
      throw new NotFoundException('Periodicidad de pago no encontrada.');
    }

    if (activo) periodicidadPago.activar();
    else periodicidadPago.desactivar();

    return this.repository.actualizar(periodicidadPago);
  }
}
