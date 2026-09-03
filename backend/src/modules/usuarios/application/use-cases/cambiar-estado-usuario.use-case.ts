import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { USUARIO_REPOSITORY, UsuarioRepository } from '../../domain/repositories/usuario.repository';
@Injectable() export class CambiarEstadoUsuarioUseCase { constructor(@Inject(USUARIO_REPOSITORY) private readonly repository: UsuarioRepository) {} async execute(id: number, activo: boolean) { const usuario = await this.repository.buscarPorId(id); if (!usuario) throw new NotFoundException('Usuario no encontrado.'); activo ? usuario.activar() : usuario.desactivar(); return this.repository.actualizar(usuario); } }
