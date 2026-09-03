import { Inject, Injectable } from '@nestjs/common';
import { PeriodicidadPago } from '../../domain/entities/periodicidad-pago';
import {
  PERIODICIDAD_PAGO_REPOSITORY,
  PeriodicidadPagoRepository,
} from '../../domain/repositories/periodicidad-pago.repository';

@Injectable()
export class ListarPeriodicidadesPagoUseCase {
  constructor(
    @Inject(PERIODICIDAD_PAGO_REPOSITORY)
    private readonly repository: PeriodicidadPagoRepository,
  ) {}

  execute(): Promise<PeriodicidadPago[]> {
    return this.repository.listar();
  }
}
