import { Inject, Injectable } from '@nestjs/common';
import { FormaPago } from '../../domain/entities/forma-pago';
import {
  FORMA_PAGO_REPOSITORY,
  FormaPagoRepository,
} from '../../domain/repositories/forma-pago.repository';

@Injectable()
export class ListarFormasPagoUseCase {
  constructor(
    @Inject(FORMA_PAGO_REPOSITORY)
    private readonly repository: FormaPagoRepository,
  ) {}

  execute(): Promise<FormaPago[]> {
    return this.repository.listar();
  }
}
