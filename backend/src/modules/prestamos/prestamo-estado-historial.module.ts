import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { PRESTAMO_ESTADO_HISTORIAL_REPOSITORY } from './domain/repositories/prestamo-estado-historial.repository';
import { PrestamoEstadoHistorialService } from './application/services/prestamo-estado-historial.service';
import { PrestamoEstadoHistorialTypeOrmRepository } from './infrastructure/persistence/typeorm/prestamo-estado-historial.typeorm-repository';
import { PrestamoEstadoHistorialOrmEntity } from './infrastructure/persistence/typeorm/prestamo-estado-historial.orm-entity';

@Module({ imports: [UsuariosModule, TypeOrmModule.forFeature([PrestamoEstadoHistorialOrmEntity])], providers: [PrestamoEstadoHistorialService, { provide: PRESTAMO_ESTADO_HISTORIAL_REPOSITORY, useClass: PrestamoEstadoHistorialTypeOrmRepository }], exports: [PrestamoEstadoHistorialService, PRESTAMO_ESTADO_HISTORIAL_REPOSITORY] })
export class PrestamoEstadoHistorialModule {}
