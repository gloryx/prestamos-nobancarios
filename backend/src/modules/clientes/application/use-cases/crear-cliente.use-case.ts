import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { Cliente, DatosCliente } from '../../domain/entities/cliente';
import { CLIENTE_REPOSITORY, ClienteRepository } from '../../domain/repositories/cliente.repository';
import { CrearClienteDto } from '../dto/crear-cliente.dto';

const datos = (dto: CrearClienteDto): DatosCliente => ({ ...dto, fechaNacimiento: dto.fechaNacimiento ? new Date(`${dto.fechaNacimiento.slice(0, 10)}T00:00:00.000Z`) : null });

@Injectable()
export class CrearClienteUseCase {
  constructor(@Inject(CLIENTE_REPOSITORY) private readonly repository: ClienteRepository) {}
  async execute(dto: CrearClienteDto): Promise<Cliente> {
    if (await this.repository.buscarPorIdentificacion(dto.identificacion)) throw new ConflictException('Ya existe un cliente con esa identificación.');
    return this.repository.guardar(Cliente.crear(datos(dto)));
  }
}
