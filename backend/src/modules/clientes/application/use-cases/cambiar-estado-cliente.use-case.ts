import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Cliente } from '../../domain/entities/cliente';
import { CLIENTE_REPOSITORY, ClienteRepository } from '../../domain/repositories/cliente.repository';

@Injectable()
export class CambiarEstadoClienteUseCase {
  constructor(@Inject(CLIENTE_REPOSITORY) private readonly repository: ClienteRepository) {}
  async execute(id: number, activo: boolean): Promise<Cliente> {
    const cliente = await this.repository.buscarPorId(id);
    if (!cliente) throw new NotFoundException('Cliente no encontrado.');
    activo ? cliente.activar() : cliente.desactivar();
    return this.repository.actualizar(cliente);
  }
}
