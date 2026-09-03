import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Cliente } from '../../domain/entities/cliente';
import { CLIENTE_REPOSITORY, ClienteRepository } from '../../domain/repositories/cliente.repository';

@Injectable()
export class ObtenerClienteUseCase {
  constructor(@Inject(CLIENTE_REPOSITORY) private readonly repository: ClienteRepository) {}
  async execute(id: number): Promise<Cliente> {
    const cliente = await this.repository.buscarPorId(id);
    if (!cliente) throw new NotFoundException('Cliente no encontrado.');
    return cliente;
  }
}
