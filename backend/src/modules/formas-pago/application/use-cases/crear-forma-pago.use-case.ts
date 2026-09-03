import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { FormaPago } from '../../domain/entities/forma-pago';
import {
  FORMA_PAGO_REPOSITORY,
  FormaPagoRepository,
} from '../../domain/repositories/forma-pago.repository';
import { CrearFormaPagoDto } from '../dto/crear-forma-pago.dto';

@Injectable()
export class CrearFormaPagoUseCase {
  constructor(
    @Inject(FORMA_PAGO_REPOSITORY)
    private readonly repository: FormaPagoRepository,
  ) {}

  async execute(dto: CrearFormaPagoDto): Promise<FormaPago> {
    const existente = await this.repository.buscarPorNombre(dto.nombre);
    if (existente) {
      throw new ConflictException(
        'Ya existe una forma de pago con ese nombre.',
      );
    }

    return this.repository.guardar(FormaPago.crear(dto.nombre));
  }
}
