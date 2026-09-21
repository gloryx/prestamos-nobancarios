import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MovimientoCajaOrmEntity } from '../../movimientos-caja/infrastructure/persistence/typeorm/movimiento-caja.orm-entity';
import { ConceptoMovimientoCaja } from '../../movimientos-caja/domain/enums/concepto-movimiento-caja.enum';
import { TipoMovimientoCaja } from '../../movimientos-caja/domain/enums/tipo-movimiento-caja.enum';
import { PagoOrmEntity } from '../../pagos/infrastructure/persistence/typeorm/pago.orm-entity';
import { EstadoPago } from '../../pagos/domain/enums/estado-pago.enum';
import type { FormaPagoReportRepository } from '../domain/repositories/forma-pago-report.repository';

const concepts = [ConceptoMovimientoCaja.DESEMBOLSO_PRESTAMO, ConceptoMovimientoCaja.DESEMBOLSO_REFINANCIAMIENTO];

export class FormaPagoReportTypeOrmRepository implements FormaPagoReportRepository {
  constructor(@InjectRepository(PagoOrmEntity) private readonly pagosRepo: Repository<PagoOrmEntity>, @InjectRepository(MovimientoCajaOrmEntity) private readonly caja: Repository<MovimientoCajaOrmEntity>) {}

  private desembolsoQuery(fechaDesde: string, fechaHasta: string) {
    return this.caja.createQueryBuilder('movimiento')
      .leftJoin(MovimientoCajaOrmEntity, 'original', 'original.id = movimiento.movimiento_reversado_id')
      .leftJoin('forma_pago', 'forma', 'forma.id = COALESCE(movimiento.forma_pago_id, original.forma_pago_id)')
      .where('movimiento.fecha >= :fechaDesde AND movimiento.fecha <= :fechaHasta', { fechaDesde, fechaHasta })
      .andWhere('((movimiento.tipo = :salida AND movimiento.concepto IN (:...conceptos)) OR (movimiento.concepto = :reverso AND original.tipo = :salida AND original.concepto IN (:...conceptos)))', { salida: TipoMovimientoCaja.SALIDA, conceptos: concepts, reverso: ConceptoMovimientoCaja.REVERSO });
  }

  async desembolsos(fechaDesde: string, fechaHasta: string) {
    const rows = await this.desembolsoQuery(fechaDesde, fechaHasta)
      .select('COALESCE(movimiento.forma_pago_id, original.forma_pago_id)', 'formaPagoId')
      .addSelect('forma.nombre', 'formaPagoNombre')
      .addSelect('COUNT(*)', 'cantidad')
      .addSelect('SUM(CASE WHEN movimiento.concepto = :reverso THEN -movimiento.monto ELSE movimiento.monto END)', 'monto')
      .setParameter('reverso', ConceptoMovimientoCaja.REVERSO)
      .groupBy('COALESCE(movimiento.forma_pago_id, original.forma_pago_id)').addGroupBy('forma.nombre')
      .having('COALESCE(movimiento.forma_pago_id, original.forma_pago_id) IS NOT NULL')
      .getRawMany<Record<string, string>>();
    return rows.map((row) => ({ formaPagoId: Number(row.formaPagoId), formaPagoNombre: row.formaPagoNombre, cantidad: Number(row.cantidad), monto: row.monto }));
  }

  async desembolsosSinForma(fechaDesde: string, fechaHasta: string) {
    const row = await this.desembolsoQuery(fechaDesde, fechaHasta)
      .select('COALESCE(SUM(CASE WHEN movimiento.concepto = :reverso THEN -movimiento.monto ELSE movimiento.monto END), 0)', 'monto')
      .addSelect('COUNT(*)', 'cantidad')
      .setParameter('reverso', ConceptoMovimientoCaja.REVERSO)
      .andWhere('COALESCE(movimiento.forma_pago_id, original.forma_pago_id) IS NULL')
      .getRawOne<Record<string, string>>();
    return { monto: row?.monto ?? '0', cantidad: row?.cantidad ?? '0' };
  }

  async pagos(fechaDesde: string, fechaHasta: string) {
    const rows = await this.pagosRepo.createQueryBuilder('pago')
      .innerJoin('pago.formaPago', 'forma')
      .select('pago.forma_pago_id', 'formaPagoId')
      .addSelect('forma.nombre', 'formaPagoNombre')
      .addSelect('COUNT(*)', 'cantidad')
      .addSelect('SUM(pago.monto)', 'monto')
      .where('pago.estado = :estado', { estado: EstadoPago.REGISTRADO })
      .andWhere('pago.fecha >= :fechaDesde AND pago.fecha <= :fechaHasta', { fechaDesde, fechaHasta })
      .groupBy('pago.forma_pago_id').addGroupBy('forma.nombre')
      .getRawMany<Record<string, string>>();
    return rows.map((row) => ({ formaPagoId: Number(row.formaPagoId), formaPagoNombre: row.formaPagoNombre, cantidad: Number(row.cantidad), monto: row.monto }));
  }
}
