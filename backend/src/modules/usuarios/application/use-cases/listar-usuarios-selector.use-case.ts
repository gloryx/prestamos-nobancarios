import { Inject, Injectable } from '@nestjs/common';
import { USUARIO_REPOSITORY, UsuarioRepository } from '../../domain/repositories/usuario.repository';

@Injectable()
export class ListarUsuariosSelectorUseCase {
  constructor(@Inject(USUARIO_REPOSITORY) private readonly repository: UsuarioRepository) {}

  execute() { return this.repository.listarSelector(); }
}
