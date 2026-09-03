import { Inject, Injectable } from '@nestjs/common';
import { USUARIO_REPOSITORY, UsuarioRepository } from '../../domain/repositories/usuario.repository';
import { FiltrosUsuariosDto } from '../dto/filtros-usuarios.dto';
@Injectable() export class ListarUsuariosUseCase { constructor(@Inject(USUARIO_REPOSITORY) private readonly repository: UsuarioRepository) {} execute(dto: FiltrosUsuariosDto) { return this.repository.listar(dto); } }
