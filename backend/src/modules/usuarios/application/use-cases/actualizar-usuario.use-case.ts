import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Usuario } from '../../domain/entities/usuario';
import { USUARIO_REPOSITORY, UsuarioRepository } from '../../domain/repositories/usuario.repository';
import { ActualizarUsuarioDto } from '../dto/actualizar-usuario.dto';
const provided = (dto: ActualizarUsuarioDto, key: string) => Object.prototype.hasOwnProperty.call(dto, key);
@Injectable()
export class ActualizarUsuarioUseCase {
  constructor(@Inject(USUARIO_REPOSITORY) private readonly repository: UsuarioRepository) {}
  async execute(id: number, dto: ActualizarUsuarioDto): Promise<Usuario> {
    const usuario = await this.repository.buscarPorId(id); if (!usuario) throw new NotFoundException('Usuario no encontrado.');
    if (dto.identificacion !== undefined) { const existente = await this.repository.buscarPorIdentificacion(dto.identificacion); if (existente && existente.id !== id) throw new ConflictException('Ya existe un usuario con esa identificación.'); }
    usuario.actualizarDatos({ identificacion: dto.identificacion ?? usuario.identificacion, nombreCompleto: dto.nombreCompleto ?? usuario.nombreCompleto, telefono: provided(dto, 'telefono') ? dto.telefono : usuario.telefono, correo: provided(dto, 'correo') ? dto.correo : usuario.correo, rol: dto.rol ?? usuario.rol });
    return this.repository.actualizar(usuario);
  }
}
