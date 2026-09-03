import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { PeriodicidadPago } from '../../domain/entities/periodicidad-pago';
import {
  PERIODICIDAD_PAGO_REPOSITORY,
  PeriodicidadPagoRepository,
} from '../../domain/repositories/periodicidad-pago.repository';
import { CrearPeriodicidadPagoDto } from '../dto/crear-periodicidad-pago.dto';

@Injectable()
export class CrearPeriodicidadPagoUseCase {
  constructor(
    @Inject(PERIODICIDAD_PAGO_REPOSITORY)
    private readonly repository: PeriodicidadPagoRepository,
  ) {}

  async execute(dto: CrearPeriodicidadPagoDto): Promise<PeriodicidadPago> {
    const existente = await this.repository.buscarPorNombre(dto.nombre);
    if (existente) {
      throw new ConflictException('Ya existe una periodicidad de pago con ese nombre.');
    }

    return this.repository.guardar(PeriodicidadPago.crear(dto.nombre));
  }
}
