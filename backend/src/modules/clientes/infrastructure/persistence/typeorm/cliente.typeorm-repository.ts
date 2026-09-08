import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, ILike, Repository, SelectQueryBuilder } from 'typeorm';
import { Cliente } from '../../../domain/entities/cliente';
import { Genero } from '../../../domain/enums/genero.enum';
import { ClienteRepository, ClientesPaginados, ClientesResumen, FiltrosClientes } from '../../../domain/repositories/cliente.repository';
import { EstadoPrestamo } from '../../../../prestamos/domain/enums/estado-prestamo.enum';
import { ClienteMapper } from './cliente.mapper';
import { ClienteOrmEntity } from './cliente.orm-entity';
import { PrestamoOrmEntity } from '../../../../prestamos/infrastructure/persistence/typeorm/prestamo.orm-entity';

const clientNameExpression = "UPPER(TRIM(CONCAT_WS(' ', cliente.primer_nombre, cliente.segundo_nombre, cliente.primer_apellido, cliente.segundo_apellido)))";

const applyOrdering = (query: SelectQueryBuilder<ClienteOrmEntity>, filtros: FiltrosClientes) => {
  const direction = filtros.direccionOrden ?? 'ASC';
  switch (filtros.ordenarPor) {
    case 'identificacion': query.orderBy('cliente.identificacion', direction).addOrderBy('cliente.id', 'DESC'); break;
    case 'nombre': {
      const supportsSelectAlias = typeof query.addSelect === 'function';
      if (supportsSelectAlias) query.addSelect(clientNameExpression, 'cliente_nombre_orden');
      query.orderBy(supportsSelectAlias ? 'cliente_nombre_orden' : clientNameExpression, direction).addOrderBy('cliente.id', 'DESC');
      break;
    }
    case 'direccion': query.orderBy('cliente.direccion', direction, 'NULLS LAST').addOrderBy('cliente.id', 'DESC'); break;
    case 'telefono': query.orderBy('cliente.telefono1', direction).addOrderBy('cliente.id', 'DESC'); break;
    case 'estado': query.orderBy('cliente.activo', direction).addOrderBy('cliente.id', 'DESC'); break;
    default: query.orderBy('cliente.primer_apellido', 'ASC').addOrderBy('cliente.primer_nombre', 'ASC');
  }
  return query;
};

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
    applyOrdering(query, filtros).skip((filtros.pagina - 1) * filtros.limite).take(filtros.limite);
    const [entities, total] = await query.getManyAndCount();
    return { datos: entities.map(ClienteMapper.toDomain), pagina: filtros.pagina, limite: filtros.limite, total, totalPaginas: Math.ceil(total / filtros.limite) };
  }

  async resumen(): Promise<ClientesResumen> {
    const raw = await this.repository.createQueryBuilder('cliente')
      .leftJoin(PrestamoOrmEntity, 'prestamo', 'prestamo.cliente_id = cliente.id AND prestamo.estado = :estadoActivo', { estadoActivo: EstadoPrestamo.ACTIVO })
      .select('COUNT(DISTINCT cliente.id)', 'total')
      .addSelect('COUNT(DISTINCT cliente.id) FILTER (WHERE cliente.genero = :masculino)', 'masculino')
      .addSelect('COUNT(DISTINCT cliente.id) FILTER (WHERE cliente.genero = :femenino)', 'femenino')
      .addSelect('COUNT(DISTINCT cliente.id) FILTER (WHERE prestamo.id IS NOT NULL)', 'conPrestamoActivo')
      .setParameters({ masculino: Genero.MASCULINO, femenino: Genero.FEMENINO })
      .getRawOne<{ total: string; masculino: string; femenino: string; conPrestamoActivo: string }>();

    return { total: Number(raw?.total ?? 0), masculino: Number(raw?.masculino ?? 0), femenino: Number(raw?.femenino ?? 0), conPrestamoActivo: Number(raw?.conPrestamoActivo ?? 0) };
  }
}
