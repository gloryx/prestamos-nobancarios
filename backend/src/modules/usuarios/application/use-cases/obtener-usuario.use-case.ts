import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { USUARIO_REPOSITORY, UsuarioRepository } from '../../domain/repositories/usuario.repository';
@Injectable() export class ObtenerUsuarioUseCase { constructor(@Inject(USUARIO_REPOSITORY) private readonly repository: UsuarioRepository) {} async execute(id: number) { const usuario = await this.repository.buscarPorId(id); if (!usuario) throw new NotFoundException('Usuario no encontrado.'); return usuario; } }
