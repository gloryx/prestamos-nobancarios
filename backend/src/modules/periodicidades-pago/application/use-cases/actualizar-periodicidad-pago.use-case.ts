import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PeriodicidadPago } from '../../domain/entities/periodicidad-pago';
import {
  PERIODICIDAD_PAGO_REPOSITORY,
  PeriodicidadPagoRepository,
} from '../../domain/repositories/periodicidad-pago.repository';
import { ActualizarPeriodicidadPagoDto } from '../dto/actualizar-periodicidad-pago.dto';

@Injectable()
export class ActualizarPeriodicidadPagoUseCase {
  constructor(
    @Inject(PERIODICIDAD_PAGO_REPOSITORY)
    private readonly repository: PeriodicidadPagoRepository,
  ) {}

  async execute(id: number, dto: ActualizarPeriodicidadPagoDto): Promise<PeriodicidadPago> {
    const periodicidadPago = await this.repository.buscarPorId(id);
    if (!periodicidadPago) {
      throw new NotFoundException('Periodicidad de pago no encontrada.');
    }

    const existente = await this.repository.buscarPorNombre(dto.nombre);
    if (existente && existente.id !== id) {
      throw new ConflictException('Ya existe una periodicidad de pago con ese nombre.');
    }

    periodicidadPago.actualizarNombre(dto.nombre);
    return this.repository.actualizar(periodicidadPago);
  }
}
