import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MovimientoCajaOrmEntity } from '../../movimientos-caja/infrastructure/persistence/typeorm/movimiento-caja.orm-entity';
import { PagoOrmEntity } from '../../pagos/infrastructure/persistence/typeorm/pago.orm-entity';
import { EstadoPago } from '../../pagos/domain/enums/estado-pago.enum';
import { ConceptoMovimientoCaja } from '../../movimientos-caja/domain/enums/concepto-movimiento-caja.enum';
import { TipoMovimientoCaja } from '../../movimientos-caja/domain/enums/tipo-movimiento-caja.enum';
import type { AnalisisFinancieroRepository } from '../domain/repositories/analisis-financiero.repository';
import { ClienteOrmEntity } from '../../clientes/infrastructure/persistence/typeorm/cliente.orm-entity';
import { PrestamoOrmEntity } from '../../prestamos/infrastructure/persistence/typeorm/prestamo.orm-entity';
import { PlanPagoOrmEntity } from '../../planes-pago/infrastructure/persistence/typeorm/plan-pago.orm-entity';
const dateOnly = (value: string | Date) => value instanceof Date ? `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}` : String(value).slice(0, 10);

function range(desde: number, hasta: number) { return { start: `${desde}-01-01`, end: `${hasta + 1}-01-01` }; }

export class AnalisisFinancieroTypeOrmRepository implements AnalisisFinancieroRepository {
  constructor(@InjectRepository(PagoOrmEntity) private readonly pagosRepo: Repository<PagoOrmEntity>, @InjectRepository(MovimientoCajaOrmEntity) private readonly cajaRepo: Repository<MovimientoCajaOrmEntity>, @InjectRepository(PrestamoOrmEntity) private readonly prestamosRepo: Repository<PrestamoOrmEntity>, @InjectRepository(PlanPagoOrmEntity) private readonly planesRepo: Repository<PlanPagoOrmEntity>) {}

  async pagos(desde: number, hasta: number) {
    const { start, end } = range(desde, hasta);
    return this.pagosRepo.createQueryBuilder('pago').select("TO_CHAR(pago.fecha, 'YYYY-MM')", 'periodo').addSelect('SUM(pago.monto)', 'monto').addSelect('SUM(pago.interesAplicado)', 'interesAplicado').where('pago.estado = :estado', { estado: EstadoPago.REGISTRADO }).andWhere('pago.fecha >= :start AND pago.fecha < :end', { start, end }).groupBy("TO_CHAR(pago.fecha, 'YYYY-MM')").getRawMany();
  }

  async prestamos(desde: number, hasta: number) {
    const { start, end } = range(desde, hasta);
    const conceptos = [ConceptoMovimientoCaja.DESEMBOLSO_PRESTAMO, ConceptoMovimientoCaja.DESEMBOLSO_REFINANCIAMIENTO];
    return this.cajaRepo.createQueryBuilder('movimiento').leftJoin(MovimientoCajaOrmEntity, 'original', 'original.id = movimiento.movimiento_reversado_id').select("TO_CHAR(movimiento.fecha, 'YYYY-MM')", 'periodo').addSelect("SUM(CASE WHEN movimiento.concepto = :reverso THEN -movimiento.monto ELSE movimiento.monto END)", 'monto').where('movimiento.fecha >= :start AND movimiento.fecha < :end', { start, end }).andWhere("((movimiento.tipo = :salida AND movimiento.concepto IN (:...conceptos)) OR (movimiento.concepto = :reverso AND original.tipo = :salida AND original.concepto IN (:...conceptos)))", { salida: TipoMovimientoCaja.SALIDA, conceptos, reverso: ConceptoMovimientoCaja.REVERSO }).groupBy("TO_CHAR(movimiento.fecha, 'YYYY-MM')").getRawMany();
  }

  async proyeccion() {
    const prestamos = await this.prestamosRepo.createQueryBuilder('prestamo').innerJoin(ClienteOrmEntity, 'cliente', 'cliente.id = prestamo.cliente_id').where('prestamo.estado IN (:...estados)', { estados: ['ACTIVO', 'INCOBRABLE'] }).andWhere(`NOT EXISTS (SELECT 1 FROM refinanciamiento ref INNER JOIN prestamo sucesor ON sucesor.id = ref.prestamo_nuevo_id WHERE ref.prestamo_origen_id = prestamo.id AND sucesor.estado IN ('ACTIVO', 'INCOBRABLE'))`).select('prestamo.id', 'id').addSelect('prestamo.cliente_id', 'clienteId').addSelect("CONCAT_WS(' ', cliente.primer_nombre, cliente.segundo_nombre, cliente.primer_apellido, cliente.segundo_apellido)", 'cliente').addSelect('prestamo.estado', 'estado').addSelect('prestamo.interes', 'interes').getRawMany();
    const ids = prestamos.map((loan) => Number(loan.id));
    if (!ids.length) return { prestamos: [], planes: [], pagos: [] };
    const planes = await this.planesRepo.createQueryBuilder('plan').where('plan.prestamo_id IN (:...ids)', { ids }).select('plan.id', 'id').addSelect('plan.prestamo_id', 'prestamoId').addSelect('plan.numero_pago', 'numeroPago').addSelect('plan.fecha_vencimiento', 'fechaVencimiento').addSelect('plan.monto_programado', 'montoProgramado').getRawMany();
    const pagos = await this.pagosRepo.createQueryBuilder('pago').where('pago.prestamo_id IN (:...ids)', { ids }).andWhere('pago.estado = :estado', { estado: EstadoPago.REGISTRADO }).andWhere('pago.plan_pago_id IS NOT NULL').select('pago.plan_pago_id', 'planPagoId').addSelect('pago.prestamo_id', 'prestamoId').addSelect('SUM(pago.monto)', 'monto').addSelect('SUM(pago.interes_aplicado)', 'interesAplicado').groupBy('pago.plan_pago_id').addGroupBy('pago.prestamo_id').getRawMany();
    return { prestamos: prestamos.map((row) => ({ ...row, id: Number(row.id), clienteId: Number(row.clienteId) })), planes: planes.map((row) => ({ ...row, id: Number(row.id), prestamoId: Number(row.prestamoId), numeroPago: Number(row.numeroPago), fechaVencimiento: dateOnly(row.fechaVencimiento) })), pagos: pagos.map((row) => ({ ...row, planPagoId: Number(row.planPagoId), prestamoId: Number(row.prestamoId) })) };
  }
}
