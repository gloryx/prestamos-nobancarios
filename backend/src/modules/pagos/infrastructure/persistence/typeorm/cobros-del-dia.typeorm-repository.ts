import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CobrosDelDiaQuery } from '../../../application/dto/cobros-del-dia-query.dto';
import { CobrosDelDiaRepository, CobrosDelDiaResult, CobroProgramado, PagoRecibido } from '../../../domain/repositories/cobros-del-dia.repository';
import { PagoOrmEntity } from './pago.orm-entity';
import { PlanPagoOrmEntity } from '../../../../planes-pago/infrastructure/persistence/typeorm/plan-pago.orm-entity';
import { PrestamoOrmEntity } from '../../../../prestamos/infrastructure/persistence/typeorm/prestamo.orm-entity';

@Injectable()
export class CobrosDelDiaTypeOrmRepository implements CobrosDelDiaRepository {
  constructor(
    @InjectRepository(PlanPagoOrmEntity) private readonly plans: Repository<PlanPagoOrmEntity>,
    @InjectRepository(PagoOrmEntity) private readonly payments: Repository<PagoOrmEntity>,
  ) {}

  async consultar(query: CobrosDelDiaQuery): Promise<CobrosDelDiaResult> {
    const dateCondition = query.fecha ? 'pago.fecha = :date' : 'pago.fecha BETWEEN :from AND :to';
    const dateParams = query.fecha ? { date: query.fecha } : { from: query.fechaDesde, to: query.fechaHasta };
    const registeredByPlan = `(SELECT pago.plan_pago_id, SUM(pago.monto) AS monto_pagado FROM pago WHERE pago.estado = 'REGISTRADO' AND pago.plan_pago_id IS NOT NULL GROUP BY pago.plan_pago_id)`;
    const registeredByLoan = `(SELECT pago.prestamo_id, SUM(pago.monto) AS total_pagado FROM pago WHERE pago.estado = 'REGISTRADO' GROUP BY pago.prestamo_id)`;
    const latestCollector = `(SELECT DISTINCT ON (pago.plan_pago_id) pago.plan_pago_id, pago.cobrador_id, usuario.nombre_completo AS cobrador_nombre FROM pago INNER JOIN usuario ON usuario.id = pago.cobrador_id WHERE pago.estado = 'REGISTRADO' AND pago.plan_pago_id IS NOT NULL ORDER BY pago.plan_pago_id, pago.fecha DESC, pago.id DESC)`;

    const obligationsQuery = this.plans.createQueryBuilder('plan')
      .innerJoin(PrestamoOrmEntity, 'prestamo', 'prestamo.id = plan.prestamo_id')
      .innerJoin('cliente', 'cliente', 'cliente.id = prestamo.cliente_id')
      .innerJoin('periodicidad_pago', 'periodicidad', 'periodicidad.id = prestamo.periodicidad_pago_id')
      .innerJoin('forma_pago', 'forma_pago', 'forma_pago.id = prestamo.forma_pago_id')
      .leftJoin(registeredByPlan, 'pago_plan', 'pago_plan.plan_pago_id = plan.id')
      .leftJoin(registeredByLoan, 'pago_prestamo', 'pago_prestamo.prestamo_id = prestamo.id')
      .leftJoin(latestCollector, 'cobrador_pago', 'cobrador_pago.plan_pago_id = plan.id')
      .select('plan.id', 'planPagoId').addSelect('plan.numero_pago', 'numeroPago').addSelect('plan.fecha_vencimiento::text', 'fecha')
      .addSelect('plan.monto_programado', 'montoProgramado')
      .addSelect('prestamo.id', 'prestamoId').addSelect('prestamo.capital', 'capital')
      .addSelect('GREATEST(plan.monto_programado - COALESCE(pago_plan.monto_pagado, 0), 0)', 'saldoPendiente')
      .addSelect('GREATEST(prestamo.monto_total - COALESCE(pago_prestamo.total_pagado, 0), 0)', 'saldoActual').addSelect('prestamo.estado', 'estadoPrestamo').addSelect('periodicidad.nombre', 'periodicidad')
      .addSelect('cliente.id', 'clienteId').addSelect("TRIM(CONCAT_WS(' ', cliente.primer_nombre, cliente.segundo_nombre, cliente.primer_apellido, cliente.segundo_apellido))", 'nombreCompleto')
      .addSelect('cliente.identificacion', 'identificacion').addSelect('cliente.telefono1', 'telefonoPrincipal').addSelect('cliente.direccion', 'direccion')
      .addSelect('forma_pago.id', 'formaPagoId').addSelect('forma_pago.nombre', 'formaPagoNombre')
      .addSelect('cobrador_pago.cobrador_id', 'cobradorId').addSelect('cobrador_pago.cobrador_nombre', 'cobradorNombre')
      .where('prestamo.estado = :active', { active: 'ACTIVO' })
      .andWhere(query.fecha ? 'plan.fecha_vencimiento = :date' : 'plan.fecha_vencimiento BETWEEN :from AND :to', dateParams)
      .andWhere('GREATEST(plan.monto_programado - COALESCE(pago_plan.monto_pagado, 0), 0) > 0')
      .orderBy('plan.fecha_vencimiento', 'ASC').addOrderBy('nombreCompleto', 'ASC').addOrderBy('prestamo.id', 'ASC').addOrderBy('plan.numero_pago', 'ASC');

    const paymentsQuery = this.payments.createQueryBuilder('pago')
      .innerJoin(PrestamoOrmEntity, 'prestamo', 'prestamo.id = pago.prestamo_id')
      .innerJoin('cliente', 'cliente', 'cliente.id = prestamo.cliente_id')
      .innerJoin('forma_pago', 'forma_pago', 'forma_pago.id = pago.forma_pago_id')
      .leftJoin('plan_pago', 'plan', 'plan.id = pago.plan_pago_id')
      .leftJoin('usuario', 'cobrador', 'cobrador.id = pago.cobrador_id')
      .select('pago.id', 'pagoId').addSelect('pago.fecha::text', 'fecha').addSelect('pago.monto', 'monto')
      .addSelect('plan.id', 'planPagoId').addSelect('plan.numero_pago', 'numeroPago').addSelect('plan.fecha_vencimiento::text', 'fechaVencimiento')
      .addSelect('prestamo.id', 'prestamoId').addSelect('prestamo.estado', 'estadoPrestamo')
      .addSelect('cliente.id', 'clienteId').addSelect("TRIM(CONCAT_WS(' ', cliente.primer_nombre, cliente.segundo_nombre, cliente.primer_apellido, cliente.segundo_apellido))", 'nombreCompleto')
      .addSelect('cliente.identificacion', 'identificacion').addSelect('cliente.telefono1', 'telefonoPrincipal').addSelect('cliente.direccion', 'direccion')
      .addSelect('forma_pago.id', 'formaPagoId').addSelect('forma_pago.nombre', 'formaPagoNombre')
      .addSelect('cobrador.id', 'cobradorId').addSelect('cobrador.nombre_completo', 'cobradorNombre')
      .where("pago.estado = 'REGISTRADO'").andWhere(dateCondition, dateParams)
      .orderBy('pago.fecha', 'ASC').addOrderBy('pago.id', 'ASC');

    const [obligationRows, paymentRows] = await Promise.all([obligationsQuery.getRawMany(), paymentsQuery.getRawMany()]);
    return { porCobrar: obligationRows.map(this.mapObligation), pagaron: paymentRows.map(this.mapPayment) };
  }

  private readonly mapObligation = (row: any): CobroProgramado => ({ ...row, planPagoId: Number(row.planPagoId), numeroPago: Number(row.numeroPago), montoProgramado: Number(row.montoProgramado), saldoPendiente: Number(row.saldoPendiente), prestamoId: Number(row.prestamoId), capital: Number(row.capital), saldoActual: Number(row.saldoActual), clienteId: Number(row.clienteId), formaPagoId: Number(row.formaPagoId), cobradorId: row.cobradorId == null ? null : Number(row.cobradorId) });
  private readonly mapPayment = (row: any): PagoRecibido => ({ ...row, pagoId: Number(row.pagoId), monto: Number(row.monto), planPagoId: row.planPagoId == null ? null : Number(row.planPagoId), numeroPago: row.numeroPago == null ? null : Number(row.numeroPago), prestamoId: Number(row.prestamoId), clienteId: Number(row.clienteId), formaPagoId: Number(row.formaPagoId), cobradorId: row.cobradorId == null ? null : Number(row.cobradorId) });
}
