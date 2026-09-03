import { Inject, Injectable } from '@nestjs/common';
import { CLIENTE_REPOSITORY, ClienteRepository, ClientesPaginados } from '../../domain/repositories/cliente.repository';
import { FiltrosClientesDto } from '../dto/filtros-clientes.dto';

@Injectable()
export class ListarClientesUseCase {
  constructor(@Inject(CLIENTE_REPOSITORY) private readonly repository: ClienteRepository) {}
  execute(dto: FiltrosClientesDto): Promise<ClientesPaginados> { return this.repository.listar(dto); }
}
