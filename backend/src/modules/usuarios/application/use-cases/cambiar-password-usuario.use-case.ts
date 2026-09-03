import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { USUARIO_REPOSITORY, UsuarioRepository } from '../../domain/repositories/usuario.repository';

@Injectable()
export class CambiarPasswordUsuarioUseCase {
  constructor(@Inject(USUARIO_REPOSITORY) private readonly repository: UsuarioRepository) {}
  async execute(id: number, password: string) {
    const usuario = await this.repository.buscarPorId(id);
    if (!usuario) throw new NotFoundException('Usuario no encontrado.');
    usuario.passwordHash = await bcrypt.hash(password, 12);
    usuario.fechaActualizacion = new Date();
    return this.repository.actualizar(usuario);
  }
}
