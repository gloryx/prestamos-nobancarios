import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { FormaPago } from '../../domain/entities/forma-pago';
import {
  FORMA_PAGO_REPOSITORY,
  FormaPagoRepository,
} from '../../domain/repositories/forma-pago.repository';

@Injectable()
export class CambiarEstadoFormaPagoUseCase {
  constructor(
    @Inject(FORMA_PAGO_REPOSITORY)
    private readonly repository: FormaPagoRepository,
  ) {}

  async execute(
    id: number,
    activo: boolean,
  ): Promise<FormaPago> {
    const formaPago = await this.repository.buscarPorId(id);
    if (!formaPago) {
      throw new NotFoundException('Forma de pago no encontrada');
    }

    if (activo) {
      formaPago.activar();
    } else {
      formaPago.desactivar();
    }

    return this.repository.actualizar(formaPago);
  }
}
