import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { PagoAnulacion } from '../../../domain/entities/pago-anulacion';
import { PagoAnulacionRepository } from '../../../domain/repositories/pago-anulacion.repository';
import { PagoAnulacionMapper } from './pago-anulacion.mapper';
import { PagoAnulacionOrmEntity } from './pago-anulacion.orm-entity';

@Injectable()
export class PagoAnulacionTypeOrmRepository implements PagoAnulacionRepository {
  private repo(manager: EntityManager): Repository<PagoAnulacionOrmEntity> { return manager.getRepository(PagoAnulacionOrmEntity); }
  async guardarEnTransaccion(manager: EntityManager, anulacion: PagoAnulacion) { return PagoAnulacionMapper.toDomain(await this.repo(manager).save(PagoAnulacionMapper.toOrm(anulacion))); }
}
