import { Usuario } from '../../../domain/entities/usuario';
import { RolUsuario } from '../../../domain/enums/rol-usuario.enum';
import { UsuarioOrmEntity } from './usuario.orm-entity';

export class UsuarioMapper {
  static toDomain(entity: UsuarioOrmEntity): Usuario {
    return new Usuario(entity.id > 0 ? entity.id : null, entity.identificacion, entity.nombreCompleto, entity.telefono, entity.correo, entity.rol as RolUsuario, entity.passwordHash, entity.fechaCreacion, entity.fechaActualizacion, entity.activo);
  }
  static toOrm(domain: Usuario): UsuarioOrmEntity {
    const entity = new UsuarioOrmEntity();
    if (domain.id !== null) entity.id = domain.id;
    entity.identificacion = domain.identificacion; entity.nombreCompleto = domain.nombreCompleto; entity.telefono = domain.telefono; entity.correo = domain.correo;
    entity.rol = domain.rol; entity.passwordHash = domain.passwordHash; entity.activo = domain.activo;
    return entity;
  }
}
