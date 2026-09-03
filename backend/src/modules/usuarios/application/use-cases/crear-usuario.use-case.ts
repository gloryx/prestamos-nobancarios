import { ConflictException, Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Usuario, DatosUsuario } from '../../domain/entities/usuario';
import { USUARIO_REPOSITORY, UsuarioRepository } from '../../domain/repositories/usuario.repository';
import { CrearUsuarioDto } from '../dto/crear-usuario.dto';
@Injectable()
export class CrearUsuarioUseCase {
  constructor(@Inject(USUARIO_REPOSITORY) private readonly repository: UsuarioRepository) {}
  async execute(dto: CrearUsuarioDto): Promise<Usuario> {
    if (await this.repository.buscarPorIdentificacion(dto.identificacion)) throw new ConflictException('Ya existe un usuario con esa identificación.');
    const datos: DatosUsuario = { identificacion: dto.identificacion, nombreCompleto: dto.nombreCompleto, telefono: dto.telefono, correo: dto.correo, rol: dto.rol, passwordHash: await bcrypt.hash(dto.password, 12) };
    return this.repository.guardar(Usuario.crear(datos));
  }
}
