import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Cliente, DatosCliente } from '../../domain/entities/cliente';
import { CLIENTE_REPOSITORY, ClienteRepository } from '../../domain/repositories/cliente.repository';
import { ActualizarClienteDto } from '../dto/actualizar-cliente.dto';

const dateValue = (value: string | null | undefined): Date | null | undefined => value === undefined ? undefined : value === null ? null : new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
const provided = (dto: ActualizarClienteDto, key: string): boolean => Object.prototype.hasOwnProperty.call(dto, key);

@Injectable()
export class ActualizarClienteUseCase {
  constructor(@Inject(CLIENTE_REPOSITORY) private readonly repository: ClienteRepository) {}
  async execute(id: number, dto: ActualizarClienteDto): Promise<Cliente> {
    const cliente = await this.repository.buscarPorId(id);
    if (!cliente) throw new NotFoundException('Cliente no encontrado.');
    if (dto.identificacion !== undefined) {
      const existente = await this.repository.buscarPorIdentificacion(dto.identificacion);
      if (existente && existente.id !== id) throw new ConflictException('Ya existe un cliente con esa identificación.');
    }
    const datos: DatosCliente = {
      identificacion: dto.identificacion ?? cliente.identificacion, primerNombre: dto.primerNombre ?? cliente.primerNombre,
      segundoNombre: provided(dto, 'segundoNombre') ? dto.segundoNombre : cliente.segundoNombre, primerApellido: dto.primerApellido ?? cliente.primerApellido,
      segundoApellido: provided(dto, 'segundoApellido') ? dto.segundoApellido : cliente.segundoApellido, genero: provided(dto, 'genero') ? dto.genero : cliente.genero,
      fechaNacimiento: provided(dto, 'fechaNacimiento') ? dateValue(dto.fechaNacimiento) ?? null : cliente.fechaNacimiento, direccion: provided(dto, 'direccion') ? dto.direccion : cliente.direccion,
      correo: provided(dto, 'correo') ? dto.correo : cliente.correo, telefono1: dto.telefono1 ?? cliente.telefono1, telefono2: provided(dto, 'telefono2') ? dto.telefono2 : cliente.telefono2,
      nacionalidad: provided(dto, 'nacionalidad') ? dto.nacionalidad : cliente.nacionalidad, observaciones: provided(dto, 'observaciones') ? dto.observaciones : cliente.observaciones,
      urlIdentificacion: provided(dto, 'urlIdentificacion') ? dto.urlIdentificacion : cliente.urlIdentificacion,
    };
    cliente.actualizarDatos(datos);
    return this.repository.actualizar(cliente);
  }
}
