import { Inject, Injectable } from '@nestjs/common';
import { CLIENTE_REPOSITORY, ClienteRepository, ClientesResumen } from '../../domain/repositories/cliente.repository';

@Injectable()
export class ResumirClientesUseCase {
  constructor(@Inject(CLIENTE_REPOSITORY) private readonly repository: ClienteRepository) {}

  execute(): Promise<ClientesResumen> {
    return this.repository.resumen();
  }
}
