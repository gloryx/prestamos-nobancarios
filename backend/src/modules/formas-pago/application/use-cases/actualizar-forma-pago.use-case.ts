import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { FormaPago } from '../../domain/entities/forma-pago';
import {
  FORMA_PAGO_REPOSITORY,
  FormaPagoRepository,
} from '../../domain/repositories/forma-pago.repository';
import { ActualizarFormaPagoDto } from '../dto/actualizar-forma-pago.dto';

@Injectable()
export class ActualizarFormaPagoUseCase {
  constructor(
    @Inject(FORMA_PAGO_REPOSITORY)
    private readonly repository: FormaPagoRepository,
  ) {}

  async execute(id: number, dto: ActualizarFormaPagoDto): Promise<FormaPago> {
    const formaPago = await this.repository.buscarPorId(id);
    if (!formaPago) {
      throw new NotFoundException('Forma de pago no encontrada');
    }

    formaPago.actualizarNombre(dto.nombre);
    return this.repository.actualizar(formaPago);
  }
}
