import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, ILike, Repository } from 'typeorm';
import { normalizeIdentificacion, Usuario } from '../../../domain/entities/usuario';
import { FiltrosUsuarios, UsuarioRepository, UsuariosPaginados, UsuarioSelector } from '../../../domain/repositories/usuario.repository';
import { UsuarioMapper } from './usuario.mapper';
import { UsuarioOrmEntity } from './usuario.orm-entity';

type DatabaseError = { code?: string; constraint?: string; detail?: string };
const uniqueError = (error: unknown): error is DatabaseError => typeof error === 'object' && error !== null && (error as DatabaseError).code === '23505';
const save = async <T>(operation: () => Promise<T>): Promise<T> => {
  try { return await operation(); } catch (error: unknown) {
    const constraint = uniqueError(error) ? `${error.constraint ?? ''} ${error.detail ?? ''}`.toLowerCase() : '';
    if (constraint.includes('identificacion')) throw new ConflictException('Ya existe un usuario con esa identificación.');
    throw error;
  }
};

@Injectable()
export class UsuarioTypeOrmRepository implements UsuarioRepository {
  constructor(@InjectRepository(UsuarioOrmEntity) private readonly repository: Repository<UsuarioOrmEntity>) {}
  async guardar(usuario: Usuario): Promise<Usuario> { return UsuarioMapper.toDomain(await save(() => this.repository.save(UsuarioMapper.toOrm(usuario)))); }
  async buscarPorId(id: number): Promise<Usuario | null> { const entity = await this.repository.findOne({ where: { id } }); return entity ? UsuarioMapper.toDomain(entity) : null; }
  async buscarPorIdEnTransaccion(manager: EntityManager, id: number): Promise<Usuario | null> { const entity = await manager.getRepository(UsuarioOrmEntity).findOne({ where: { id } }); return entity ? UsuarioMapper.toDomain(entity) : null; }
  async buscarPorIdentificacion(identificacion: string): Promise<Usuario | null> { const entity = await this.repository.findOne({ where: { identificacion: ILike(normalizeIdentificacion(identificacion)) } }); return entity ? UsuarioMapper.toDomain(entity) : null; }
  async actualizar(usuario: Usuario): Promise<Usuario> { return UsuarioMapper.toDomain(await save(() => this.repository.save(UsuarioMapper.toOrm(usuario)))); }
  async listar(filtros: FiltrosUsuarios): Promise<UsuariosPaginados> {
    const query = this.repository.createQueryBuilder('usuario');
    if (filtros.buscar?.trim()) { const term = `%${filtros.buscar.trim()}%`; query.andWhere(new Brackets((where) => where.where('usuario.identificacion ILIKE :term', { term }).orWhere('usuario.nombre_completo ILIKE :term', { term }).orWhere('usuario.telefono ILIKE :term', { term }).orWhere('usuario.correo ILIKE :term', { term }))); }
    if (filtros.activo !== undefined) query.andWhere('usuario.activo = :activo', { activo: filtros.activo });
    if (filtros.rol !== undefined) query.andWhere('usuario.rol = :rol', { rol: filtros.rol });
    query.orderBy('usuario.nombre_completo', 'ASC').addOrderBy('usuario.id', 'ASC').skip((filtros.pagina - 1) * filtros.limite).take(Math.min(filtros.limite, 100));
    const [entities, total] = await query.getManyAndCount();
    return { datos: entities.map(UsuarioMapper.toDomain), pagina: filtros.pagina, limite: filtros.limite, total, totalPaginas: Math.ceil(total / filtros.limite) };
  }
  async listarSelector(): Promise<UsuarioSelector[]> {
    return this.repository.createQueryBuilder('usuario')
      .select('usuario.id', 'id')
      .addSelect('usuario.nombre_completo', 'nombreCompleto')
      .where('usuario.activo = :activo', { activo: true })
      .orderBy('usuario.nombre_completo', 'ASC')
      .addOrderBy('usuario.id', 'ASC')
      .getRawMany<UsuarioSelector>();
  }
}
