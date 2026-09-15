import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MovimientoCajaOrmEntity } from '../../movimientos-caja/infrastructure/persistence/typeorm/movimiento-caja.orm-entity';
import { PagoOrmEntity } from '../../pagos/infrastructure/persistence/typeorm/pago.orm-entity';
import { EstadoPago } from '../../pagos/domain/enums/estado-pago.enum';
import { ConceptoMovimientoCaja } from '../../movimientos-caja/domain/enums/concepto-movimiento-caja.enum';
import { TipoMovimientoCaja } from '../../movimientos-caja/domain/enums/tipo-movimiento-caja.enum';
import type { FlujoPrestamosRepository } from '../domain/repositories/flujo-prestamos.repository';

const bounds = (desde: string, hasta: string) => ({ start: `${desde}-01`, end: `${hasta}-01` });
export class FlujoPrestamosTypeOrmRepository implements FlujoPrestamosRepository {
  constructor(@InjectRepository(PagoOrmEntity) private readonly pagosRepo: Repository<PagoOrmEntity>, @InjectRepository(MovimientoCajaOrmEntity) private readonly cajaRepo: Repository<MovimientoCajaOrmEntity>) {}
  async pagos(desde: string, hasta: string) { const { start, end } = bounds(desde, hasta); return this.pagosRepo.createQueryBuilder('pago').select("TO_CHAR(pago.fecha, 'YYYY-MM')", 'periodo').addSelect('SUM(pago.monto)', 'monto').addSelect('SUM(pago.capitalAplicado)', 'capitalAplicado').addSelect('SUM(pago.interesAplicado)', 'interesAplicado').where('pago.estado = :estado', { estado: EstadoPago.REGISTRADO }).andWhere('pago.fecha >= :start AND pago.fecha < (:end::date + INTERVAL \'1 month\')', { start, end }).groupBy("TO_CHAR(pago.fecha, 'YYYY-MM')").getRawMany(); }
  async desembolsos(desde: string, hasta: string) { const { start, end } = bounds(desde, hasta); return this.cajaRepo.createQueryBuilder('movimiento').leftJoin(MovimientoCajaOrmEntity, 'original', 'original.id = movimiento.movimiento_reversado_id').select("TO_CHAR(movimiento.fecha, 'YYYY-MM')", 'periodo').addSelect("SUM(CASE WHEN movimiento.concepto = :reverso THEN -movimiento.monto ELSE movimiento.monto END)", 'monto').where('movimiento.fecha >= :start AND movimiento.fecha < (:end::date + INTERVAL \'1 month\')', { start, end }).andWhere("((movimiento.tipo = :salida AND movimiento.concepto IN (:...conceptos)) OR (movimiento.concepto = :reverso AND original.tipo = :salida AND original.concepto IN (:...conceptos)))", { salida: TipoMovimientoCaja.SALIDA, conceptos: [ConceptoMovimientoCaja.DESEMBOLSO_PRESTAMO, ConceptoMovimientoCaja.DESEMBOLSO_REFINANCIAMIENTO], reverso: ConceptoMovimientoCaja.REVERSO }).groupBy("TO_CHAR(movimiento.fecha, 'YYYY-MM')").getRawMany(); }
}
