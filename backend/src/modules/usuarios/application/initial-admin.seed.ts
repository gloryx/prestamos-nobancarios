import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CrearUsuarioUseCase } from './use-cases/crear-usuario.use-case';
import { RolUsuario } from '../domain/enums/rol-usuario.enum';
import { USUARIO_REPOSITORY, UsuarioRepository } from '../domain/repositories/usuario.repository';

const required = (config: ConfigService, name: string): string => {
  const value = config.get<string>(name);
  if (!value?.trim()) throw new Error(`${name} es obligatorio cuando no existe un administrador.`);
  return value;
};

@Injectable()
export class InitialAdminSeed {
  private static bootstrapPromise: Promise<void> | null = null;

  constructor(
    @Inject(USUARIO_REPOSITORY) private readonly repository: UsuarioRepository,
    private readonly crearUsuario: CrearUsuarioUseCase,
    private readonly config: ConfigService,
  ) {}

  seed(): Promise<void> {
    if (!InitialAdminSeed.bootstrapPromise) {
      InitialAdminSeed.bootstrapPromise = this.run().finally(() => {
        InitialAdminSeed.bootstrapPromise = null;
      });
    }
    return InitialAdminSeed.bootstrapPromise;
  }

  private async run(): Promise<void> {
    const admins = await this.repository.listar({ pagina: 1, limite: 1, rol: RolUsuario.ADMINISTRADOR });
    if (admins.total > 0) return;

    const usuario = {
      identificacion: required(this.config, 'SEED_ADMIN_IDENTIFICACION'),
      nombreCompleto: required(this.config, 'SEED_ADMIN_NOMBRE'),
      telefono: required(this.config, 'SEED_ADMIN_TELEFONO'),
      correo: required(this.config, 'SEED_ADMIN_CORREO'),
      rol: RolUsuario.ADMINISTRADOR,
      password: required(this.config, 'SEED_ADMIN_PASSWORD'),
    };

    try {
      await this.crearUsuario.execute(usuario);
    } catch (error: unknown) {
      // Only a duplicate identification from a concurrent seed is retry-safe.
      if (!(error instanceof ConflictException) ||
        (await this.repository.listar({ pagina: 1, limite: 1, rol: RolUsuario.ADMINISTRADOR })).total === 0) throw error;
    }
  }
}
