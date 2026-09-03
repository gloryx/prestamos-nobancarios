import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { FormaPago } from '../../domain/entities/forma-pago';
import {
  FORMA_PAGO_REPOSITORY,
  FormaPagoRepository,
} from '../../domain/repositories/forma-pago.repository';

@Injectable()
export class ObtenerFormaPagoUseCase {
  constructor(
    @Inject(FORMA_PAGO_REPOSITORY)
    private readonly repository: FormaPagoRepository,
  ) {}

  async execute(id: number): Promise<FormaPago> {
    const formaPago = await this.repository.buscarPorId(id);
    if (!formaPago) {
      throw new NotFoundException('Forma de pago no encontrada');
    }

    return formaPago;
  }
}
