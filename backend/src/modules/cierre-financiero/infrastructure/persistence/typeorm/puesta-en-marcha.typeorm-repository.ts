import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { crearPuestaEnMarcha } from '../../../domain/puesta-en-marcha';
import { CrearPuestaEnMarchaPersistencia, PuestaEnMarchaPersistida, PuestaEnMarchaRepository } from '../../../domain/repositories/puesta-en-marcha.repository';
import { PuestaEnMarchaMapper } from './puesta-en-marcha.mapper';
import { PuestaMarchaFinancieraOrmEntity, PuestaMarchaFinancieraSaldoOrmEntity } from './puesta-en-marcha.orm-entities';

@Injectable()
export class PuestaEnMarchaTypeOrmRepository implements PuestaEnMarchaRepository {
  private puestaRepository(manager: EntityManager): Repository<PuestaMarchaFinancieraOrmEntity> { return manager.getRepository(PuestaMarchaFinancieraOrmEntity); }
  private toPersisted(entity: PuestaMarchaFinancieraOrmEntity): PuestaEnMarchaPersistida { return { id: entity.id, configuracionFinancieraId: entity.configuracionFinancieraId, usuarioConfirmacionId: entity.usuarioConfirmacionId, fechaConfirmacion: entity.fechaConfirmacion, fechaCreacion: entity.fechaCreacion, puestaEnMarcha: PuestaEnMarchaMapper.toDomain(entity) }; }
  async findByConfiguracionId(manager: EntityManager, configuracionFinancieraId: number): Promise<PuestaEnMarchaPersistida | null> {
    const entity = await this.puestaRepository(manager).createQueryBuilder('puesta').leftJoinAndSelect('puesta.saldos', 'saldo').where('puesta.configuracionFinancieraId = :configuracionFinancieraId', { configuracionFinancieraId }).getOne();
    return entity ? this.toPersisted(entity) : null;
  }
  async existsByConfiguracionId(manager: EntityManager, configuracionFinancieraId: number): Promise<boolean> { return (await this.puestaRepository(manager).count({ where: { configuracionFinancieraId } })) > 0; }
  async create(manager: EntityManager, input: CrearPuestaEnMarchaPersistencia): Promise<PuestaEnMarchaPersistida> {
    const domain = crearPuestaEnMarcha(input.puestaEnMarcha);
    if (domain.saldos.length !== 4) throw new Error('Puesta en marcha persistence requires exactly four saldo rows.');
    const saved = await this.puestaRepository(manager).save(PuestaEnMarchaMapper.toOrm(domain, input.configuracionFinancieraId, input.usuarioConfirmacionId, input.fechaConfirmacion ?? new Date()));
    const saldos = await manager.getRepository(PuestaMarchaFinancieraSaldoOrmEntity).save(domain.saldos.map((saldo) => PuestaEnMarchaMapper.saldoToOrm(saldo, saved.id)));
    saved.saldos = saldos;
    return this.toPersisted(saved);
  }
}
