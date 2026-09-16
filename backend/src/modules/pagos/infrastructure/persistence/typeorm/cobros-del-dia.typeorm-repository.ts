import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CobrosDelDiaQuery } from '../../../application/dto/cobros-del-dia-query.dto';
import { CobroDelDia, CobrosDelDiaRepository } from '../../../domain/repositories/cobros-del-dia.repository';
import { PlanPagoOrmEntity } from '../../../../planes-pago/infrastructure/persistence/typeorm/plan-pago.orm-entity';
import { PrestamoOrmEntity } from '../../../../prestamos/infrastructure/persistence/typeorm/prestamo.orm-entity';

@Injectable()
export class CobrosDelDiaTypeOrmRepository implements CobrosDelDiaRepository {
  constructor(@InjectRepository(PlanPagoOrmEntity) private readonly plans: Repository<PlanPagoOrmEntity>) {}

  async consultar(query: CobrosDelDiaQuery): Promise<CobroDelDia[]> {
    const registeredByPlan = `(SELECT p.plan_pago_id, SUM(p.monto) AS monto_pagado FROM pago p WHERE p.estado = 'REGISTRADO' AND p.plan_pago_id IS NOT NULL GROUP BY p.plan_pago_id)`;
    const registeredByLoan = `(SELECT p.prestamo_id, SUM(p.monto) AS total_pagado FROM pago p WHERE p.estado = 'REGISTRADO' GROUP BY p.prestamo_id)`;
    const latestCollector = `(SELECT DISTINCT ON (p.plan_pago_id) p.plan_pago_id, p.cobrador_id, u.nombre_completo AS cobrador_nombre FROM pago p INNER JOIN usuario u ON u.id = p.cobrador_id WHERE p.estado = 'REGISTRADO' AND p.plan_pago_id IS NOT NULL ORDER BY p.plan_pago_id, p.fecha DESC, p.id DESC)`;
    const q = this.plans.createQueryBuilder('plan')
      .innerJoin(PrestamoOrmEntity, 'prestamo', 'prestamo.id = plan.prestamo_id')
      .innerJoin('cliente', 'cliente', 'cliente.id = prestamo.cliente_id')
      .innerJoin('periodicidad_pago', 'periodicidad', 'periodicidad.id = prestamo.periodicidad_pago_id')
      .innerJoin('forma_pago', 'forma_pago', 'forma_pago.id = prestamo.forma_pago_id')
      .leftJoin(registeredByPlan, 'pago_plan', 'pago_plan.plan_pago_id = plan.id')
      .leftJoin(registeredByLoan, 'pago_prestamo', 'pago_prestamo.prestamo_id = prestamo.id')
      .leftJoin(latestCollector, 'cobrador_pago', 'cobrador_pago.plan_pago_id = plan.id')
      .select('plan.id', 'planPagoId').addSelect('plan.numero_pago', 'numeroPago').addSelect('plan.fecha_vencimiento::text', 'fecha')
      .addSelect('plan.monto_programado', 'montoProgramado').addSelect('COALESCE(pago_plan.monto_pagado, 0)', 'montoPagado')
      .addSelect("CASE WHEN COALESCE(pago_plan.monto_pagado, 0) > 0 THEN 'PAGADO' ELSE 'PENDIENTE' END", 'estado')
      .addSelect('prestamo.id', 'prestamoId').addSelect('prestamo.capital', 'capital')
      .addSelect('GREATEST(prestamo.monto_total - COALESCE(pago_prestamo.total_pagado, 0), 0)', 'saldoActual')
      .addSelect('prestamo.estado', 'estadoPrestamo').addSelect('periodicidad.nombre', 'periodicidad')
      .addSelect('cliente.id', 'clienteId').addSelect("TRIM(CONCAT_WS(' ', cliente.primer_nombre, cliente.segundo_nombre, cliente.primer_apellido, cliente.segundo_apellido))", 'nombreCompleto')
      .addSelect('cliente.identificacion', 'identificacion').addSelect('cliente.telefono1', 'telefonoPrincipal').addSelect('cliente.direccion', 'direccion')
      .addSelect('forma_pago.id', 'formaPagoId').addSelect('forma_pago.nombre', 'formaPagoNombre')
      .addSelect('cobrador_pago.cobrador_id', 'cobradorId').addSelect('cobrador_pago.cobrador_nombre', 'cobradorNombre')
      .where('prestamo.estado = :active', { active: 'ACTIVO' });
    if (query.fecha) q.andWhere('plan.fecha_vencimiento = :date', { date: query.fecha });
    else q.andWhere('plan.fecha_vencimiento BETWEEN :from AND :to', { from: query.fechaDesde, to: query.fechaHasta });
    const rows = await q.orderBy('plan.fecha_vencimiento', 'ASC').addOrderBy('nombreCompleto', 'ASC').addOrderBy('prestamo.id', 'ASC').addOrderBy('plan.numero_pago', 'ASC').getRawMany();
    return rows.map((row) => ({ ...row, planPagoId: Number(row.planPagoId), numeroPago: Number(row.numeroPago), montoProgramado: Number(row.montoProgramado), montoPagado: Number(row.montoPagado), prestamoId: Number(row.prestamoId), capital: Number(row.capital), saldoActual: Number(row.saldoActual), clienteId: Number(row.clienteId), formaPagoId: Number(row.formaPagoId), cobradorId: row.cobradorId == null ? null : Number(row.cobradorId) }));
  }
}
