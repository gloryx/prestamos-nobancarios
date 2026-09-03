import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActualizarUsuarioUseCase } from './application/use-cases/actualizar-usuario.use-case';
import { CambiarEstadoUsuarioUseCase } from './application/use-cases/cambiar-estado-usuario.use-case';
import { CrearUsuarioUseCase } from './application/use-cases/crear-usuario.use-case';
import { ListarUsuariosUseCase } from './application/use-cases/listar-usuarios.use-case';
import { ObtenerUsuarioUseCase } from './application/use-cases/obtener-usuario.use-case';
import { CambiarPasswordUsuarioUseCase } from './application/use-cases/cambiar-password-usuario.use-case';
import { USUARIO_REPOSITORY } from './domain/repositories/usuario.repository';
import { UsuarioTypeOrmRepository } from './infrastructure/persistence/typeorm/usuario.typeorm-repository';
import { UsuarioOrmEntity } from './infrastructure/persistence/typeorm/usuario.orm-entity';
import { UsuariosController } from './presentation/controllers/usuarios.controller';
import { InitialAdminSeed } from './application/initial-admin.seed';

@Module({ imports: [TypeOrmModule.forFeature([UsuarioOrmEntity])], controllers: [UsuariosController], providers: [CrearUsuarioUseCase, ListarUsuariosUseCase, ObtenerUsuarioUseCase, ActualizarUsuarioUseCase, CambiarEstadoUsuarioUseCase, CambiarPasswordUsuarioUseCase, InitialAdminSeed, { provide: USUARIO_REPOSITORY, useClass: UsuarioTypeOrmRepository }], exports: [USUARIO_REPOSITORY, InitialAdminSeed] })
export class UsuariosModule {}
