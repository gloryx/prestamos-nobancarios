import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, ILike, Repository } from 'typeorm';
import { Cliente } from '../../../domain/entities/cliente';
import { ClienteRepository, ClientesPaginados, FiltrosClientes } from '../../../domain/repositories/cliente.repository';
import { ClienteMapper } from './cliente.mapper';
import { ClienteOrmEntity } from './cliente.orm-entity';

@Injectable()
export class ClienteTypeOrmRepository implements ClienteRepository {
  constructor(@InjectRepository(ClienteOrmEntity) private readonly repository: Repository<ClienteOrmEntity>) {}

  async guardar(cliente: Cliente): Promise<Cliente> {
    return ClienteMapper.toDomain(await this.repository.save(ClienteMapper.toOrm(cliente)));
  }

  async buscarPorId(id: number): Promise<Cliente | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? ClienteMapper.toDomain(entity) : null;
  }
  async buscarPorIdEnTransaccion(manager: EntityManager, id: number): Promise<Cliente | null> { const entity = await manager.getRepository(ClienteOrmEntity).findOne({ where: { id } }); return entity ? ClienteMapper.toDomain(entity) : null; }

  async buscarPorIdentificacion(identificacion: string): Promise<Cliente | null> {
    const entity = await this.repository.findOne({ where: { identificacion: ILike(identificacion.trim().toUpperCase()) } });
    return entity ? ClienteMapper.toDomain(entity) : null;
  }

  async actualizar(cliente: Cliente): Promise<Cliente> {
    return ClienteMapper.toDomain(await this.repository.save(ClienteMapper.toOrm(cliente)));
  }

  async listar(filtros: FiltrosClientes): Promise<ClientesPaginados> {
    const query = this.repository.createQueryBuilder('cliente');
    if (filtros.buscar?.trim()) {
      const term = `%${filtros.buscar.trim()}%`;
      query.andWhere(new Brackets((where) => where
        .where('cliente.identificacion ILIKE :term', { term })
        .orWhere('cliente.primer_nombre ILIKE :term', { term })
        .orWhere('cliente.segundo_nombre ILIKE :term', { term })
        .orWhere('cliente.primer_apellido ILIKE :term', { term })
        .orWhere('cliente.segundo_apellido ILIKE :term', { term })
        .orWhere('cliente.telefono1 ILIKE :term', { term })
        .orWhere('cliente.telefono2 ILIKE :term', { term })
        .orWhere('cliente.correo ILIKE :term', { term })));
    }
    if (filtros.direccion?.trim()) {
      query.andWhere('cliente.direccion ILIKE :direccion', { direccion: `%${filtros.direccion.trim()}%` });
    }
    if (filtros.activo !== undefined) query.andWhere('cliente.activo = :activo', { activo: filtros.activo });
    query.orderBy('cliente.primer_apellido', 'ASC').addOrderBy('cliente.primer_nombre', 'ASC');
    query.skip((filtros.pagina - 1) * filtros.limite).take(filtros.limite);
    const [entities, total] = await query.getManyAndCount();
    return { datos: entities.map(ClienteMapper.toDomain), pagina: filtros.pagina, limite: filtros.limite, total, totalPaginas: Math.ceil(total / filtros.limite) };
  }
}
