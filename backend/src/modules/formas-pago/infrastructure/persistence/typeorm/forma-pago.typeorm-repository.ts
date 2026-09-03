import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, ILike, Repository } from 'typeorm';
import { FormaPago } from '../../../domain/entities/forma-pago';
import { FormaPagoRepository } from '../../../domain/repositories/forma-pago.repository';
import { FormaPagoOrmEntity } from './forma-pago.orm-entity';
import { FormaPagoMapper } from './forma-pago.mapper';

@Injectable()
export class FormaPagoTypeOrmRepository implements FormaPagoRepository {
  constructor(
    @InjectRepository(FormaPagoOrmEntity)
    private readonly repository: Repository<FormaPagoOrmEntity>,
  ) {}

  async guardar(formaPago: FormaPago): Promise<FormaPago> {
    const entity = await this.repository.save(FormaPagoMapper.toOrm(formaPago));
    return FormaPagoMapper.toDomain(entity);
  }

  async buscarPorId(id: number): Promise<FormaPago | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? FormaPagoMapper.toDomain(entity) : null;
  }

  async buscarPorIdEnTransaccion(manager: EntityManager, id: number): Promise<FormaPago | null> {
    const entity = await manager.getRepository(FormaPagoOrmEntity).findOne({ where: { id } });
    return entity ? FormaPagoMapper.toDomain(entity) : null;
  }

  async buscarPorNombre(nombre: string): Promise<FormaPago | null> {
    const entity = await this.repository.findOne({
      where: { nombre: ILike(nombre.trim()) },
    });

    return entity ? FormaPagoMapper.toDomain(entity) : null;
  }

  async listar(): Promise<FormaPago[]> {
    const entities = await this.repository.find({ order: { nombre: 'ASC' } });
    return entities.map((entity) => FormaPagoMapper.toDomain(entity));
  }

  async actualizar(formaPago: FormaPago): Promise<FormaPago> {
    const entity = await this.repository.save(FormaPagoMapper.toOrm(formaPago));
    return FormaPagoMapper.toDomain(entity);
  }
}
