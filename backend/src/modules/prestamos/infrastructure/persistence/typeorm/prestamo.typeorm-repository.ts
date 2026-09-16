import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { Prestamo } from '../../../domain/entities/prestamo';
import { FiltrosPrestamos, PrestamoConRelaciones, PrestamoParaExportacion, PrestamoRepository, PrestamosPaginados, PrestamosResumen } from '../../../domain/repositories/prestamo.repository';
import { PrestamoMapper } from './prestamo.mapper';
import { PrestamoOrmEntity } from './prestamo.orm-entity';
import { EstadoPrestamo } from '../../../domain/enums/estado-prestamo.enum';
import { FiltrosIncobrablesDto, OrdenarIncobrablesPor } from '../../../application/dto/filtros-incobrables.dto';
import { AnulacionListado, AnulacionesPaginadas, IncobrableListado, IncobrablesPaginados } from '../../../domain/repositories/prestamo.repository';
import { economicDateOnly } from '../../../../../common/economic-date';

const clientNameExpression = "UPPER(TRIM(CONCAT_WS(' ', cliente.primer_nombre, cliente.segundo_nombre, cliente.primer_apellido, cliente.segundo_apellido)))";
const statePriorityExpression = "CASE prestamo.estado WHEN 'ACTIVO' THEN 1 WHEN 'INCOBRABLE' THEN 2 WHEN 'REFINANCIADO' THEN 3 WHEN 'CANCELADO' THEN 4 ELSE 5 END";
const statePriorityFallbackExpression = "CASE prestamo.estado WHEN 'ACTIVO' THEN 1 WHEN 'INCOBRABLE' THEN 2 WHEN 'REFINANCIADO' THEN 3 WHEN 'CANCELADO' THEN 4 END";
// Real cancellation is the latest CANCELADO transition, ordered by economic date and history id.
const realCancellationDateExpression = "(SELECT h.fecha FROM prestamo_estado_historial h WHERE h.prestamo_id = prestamo.id AND h.estado_nuevo = 'CANCELADO' ORDER BY h.fecha DESC, h.id DESC LIMIT 1)";

const serializeRawDateOnly = (value: unknown): string | null => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    // PostgreSQL history.fecha is a calendar date; raw Date values are formatted locally to avoid UTC day shifts.
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(value.trim());
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
};

const paymentTotalsQuery = (repository: Repository<PrestamoOrmEntity>) => repository.manager.createQueryBuilder()
  .select('pago.prestamo_id', 'prestamo_id')
   .addSelect('SUM(pago.monto)', 'total_pagado')
  .from('pago', 'pago')
    .where("pago.estado = 'REGISTRADO'")
   .groupBy('pago.prestamo_id');

const applyCandidateOrdering = (query: SelectQueryBuilder<PrestamoOrmEntity>, filtros: FiltrosPrestamos) => {
  const ids = filtros.candidateIds ?? [];
  const direction = filtros.direccionOrden ?? 'ASC';
  const expression = `CASE ${ids.map((id, index) => `WHEN prestamo.id = :candidateOrder${index} THEN ${direction === 'DESC' ? ids.length - index : index}`).join(' ')} ELSE ${ids.length} END`;
  ids.forEach((id, index) => query.setParameter(`candidateOrder${index}`, id));
  query.addSelect(expression, 'cobranza_sort');
  return query.orderBy('cobranza_sort', direction).addOrderBy('prestamo.id', direction);
};

const applyOrdering = (query: SelectQueryBuilder<PrestamoOrmEntity>, filtros: FiltrosPrestamos) => {
  const direction = filtros.direccionOrden ?? 'ASC';
  switch (filtros.ordenarPor) {
    case 'id': query.orderBy('prestamo.id', direction); break;
    case 'cliente': {
      const supportsSelectAlias = typeof query.addSelect === 'function';
      if (supportsSelectAlias) query.addSelect(clientNameExpression, 'cliente_nombre_orden');
      query.orderBy(supportsSelectAlias ? 'cliente_nombre_orden' : clientNameExpression, direction).addOrderBy('prestamo.id', 'DESC');
      break;
    }
    case 'direccion': query.orderBy('cliente.direccion', direction, 'NULLS LAST').addOrderBy('prestamo.id', 'DESC'); break;
    case 'fechaAlta': query.orderBy('prestamo.fecha_alta', direction).addOrderBy('prestamo.id', direction); break;
    case 'fechaCancelacion': query.orderBy('fecha_cancelacion_orden', direction, 'NULLS LAST').addOrderBy('prestamo.id', direction); break;
    case 'capital': query.orderBy('prestamo.capital', direction).addOrderBy('prestamo.id', 'DESC'); break;
    case 'saldoPendiente': {
      query.orderBy('saldo_pendiente_orden', direction).addOrderBy('prestamo.id', direction);
      break;
    }
    case 'indicadorCobranza': applyCandidateOrdering(query, filtros); break;
    case 'estado': {
      const supportsSelectAlias = typeof query.addSelect === 'function';
      if (supportsSelectAlias) query.addSelect(statePriorityExpression, 'estado_orden');
      query.orderBy(supportsSelectAlias ? 'estado_orden' : statePriorityFallbackExpression, direction).addOrderBy('prestamo.id', 'DESC');
      break;
    }
    default: query.orderBy('prestamo.fecha_alta', 'DESC').addOrderBy('prestamo.id', 'DESC');
  }
  return query;
};

const applyClientSearch = (query: SelectQueryBuilder<PrestamoOrmEntity>, value: string | undefined, parameterPrefix: string) => {
  const terms = value?.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean) ?? [];
  terms.forEach((term, index) => {
    const parameter = `${parameterPrefix}${index}`;
    const search = `%${term}%`;
    query.andWhere(new Brackets((where) => where
      .where(`${clientNameExpression} ILIKE :${parameter}`, { [parameter]: search })
      .orWhere(`cliente.identificacion ILIKE :${parameter}`, { [parameter]: search })
      .orWhere(`cliente.telefono1 ILIKE :${parameter}`, { [parameter]: search })
      .orWhere(`cliente.telefono2 ILIKE :${parameter}`, { [parameter]: search })
      .orWhere(`cliente.direccion ILIKE :${parameter}`, { [parameter]: search })));
  });
  return query;
};

@Injectable()
export class PrestamoTypeOrmRepository implements PrestamoRepository {
  constructor(@InjectRepository(PrestamoOrmEntity) private readonly repository: Repository<PrestamoOrmEntity>) {}
  private withRelations() { return this.repository.createQueryBuilder('prestamo').leftJoinAndSelect('prestamo.cliente', 'cliente').leftJoinAndSelect('prestamo.periodicidadPago', 'periodicidadPago').leftJoinAndSelect('prestamo.formaPago', 'formaPago').leftJoinAndSelect('prestamo.formaDesembolso', 'formaDesembolso'); }
  async guardar(prestamo: Prestamo): Promise<PrestamoConRelaciones> { const saved = await this.repository.save(PrestamoMapper.toOrm(prestamo)); return this.buscarPorId(saved.id) as Promise<PrestamoConRelaciones>; }
  async buscarPorId(id: number): Promise<PrestamoConRelaciones | null> { const entity = await this.withRelations().where('prestamo.id = :id', { id }).getOne(); return entity ? PrestamoMapper.toDomain(entity) : null; }
  async actualizar(prestamo: Prestamo): Promise<PrestamoConRelaciones> { const saved = await this.repository.save(PrestamoMapper.toOrm(prestamo)); return this.buscarPorId(saved.id) as Promise<PrestamoConRelaciones>; }
  private applyFilters(query: SelectQueryBuilder<PrestamoOrmEntity>, filtros: FiltrosPrestamos) {
    applyClientSearch(query, filtros.buscar, 'buscarTerm');
    if (filtros.direccion?.trim()) query.andWhere('cliente.direccion ILIKE :direccion', { direccion: `%${filtros.direccion.trim()}%` });
    if (filtros.estados !== undefined) {
      if (filtros.estados.length) query.andWhere('prestamo.estado IN (:...estados)', { estados: filtros.estados });
      else query.andWhere('1 = 0');
    } else if (filtros.estado !== undefined) query.andWhere('prestamo.estado = :estado', { estado: filtros.estado });
    if (filtros.fechaInicio) query.andWhere('prestamo.fecha_alta >= :fechaInicio', { fechaInicio: filtros.fechaInicio });
    if (filtros.fechaFin) query.andWhere('prestamo.fecha_alta <= :fechaFin', { fechaFin: filtros.fechaFin });
    if (filtros.fechaCancelacionDesde) query.andWhere(`${realCancellationDateExpression} >= CAST(:fechaCancelacionDesde AS date)`, { fechaCancelacionDesde: filtros.fechaCancelacionDesde });
    if (filtros.fechaCancelacionHasta) query.andWhere(`${realCancellationDateExpression} < (CAST(:fechaCancelacionHasta AS date) + INTERVAL '1 day')`, { fechaCancelacionHasta: filtros.fechaCancelacionHasta });
    if (filtros.clienteId !== undefined) query.andWhere('prestamo.cliente_id = :clienteId', { clienteId: filtros.clienteId });
    if (filtros.candidateIds !== undefined) {
      if (filtros.candidateIds.length) query.andWhere('prestamo.id IN (:...candidateIds)', { candidateIds: filtros.candidateIds });
      else query.andWhere('1 = 0');
    }
    return query;
  }
  async listarParaIndicador(filtros: FiltrosPrestamos): Promise<PrestamoConRelaciones[]> {
    const entities = await this.applyFilters(this.withRelations(), filtros).getMany();
    return entities.map((entity) => PrestamoMapper.toDomain(entity));
  }
  async listar(filtros: FiltrosPrestamos): Promise<PrestamosPaginados> {
    const query = this.applyFilters(this.withRelations(), filtros);
    const incluyeCancelados = filtros.estados?.includes(EstadoPrestamo.CANCELADO) || filtros.estado === EstadoPrestamo.CANCELADO;
    if (incluyeCancelados) {
      query.addSelect(realCancellationDateExpression, 'fecha_cancelacion_orden')
        .addSelect(realCancellationDateExpression, 'cancelacion_fecha')
        .addSelect("(SELECT u.id FROM prestamo_estado_historial h JOIN usuario u ON u.id = h.usuario_id WHERE h.prestamo_id = prestamo.id AND h.estado_nuevo = 'CANCELADO' ORDER BY h.fecha DESC, h.id DESC LIMIT 1)", 'cancelacion_usuario_id')
        .addSelect("(SELECT u.nombre_completo FROM prestamo_estado_historial h JOIN usuario u ON u.id = h.usuario_id WHERE h.prestamo_id = prestamo.id AND h.estado_nuevo = 'CANCELADO' ORDER BY h.fecha DESC, h.id DESC LIMIT 1)", 'cancelacion_usuario_nombre');
    }
    if (filtros.ordenarPor === 'saldoPendiente') {
      const paymentTotals = paymentTotalsQuery(this.repository);
      query.leftJoin(`(${paymentTotals.getQuery()})`, 'pagos_orden', 'pagos_orden.prestamo_id = prestamo.id')
        .setParameters(paymentTotals.getParameters())
       .addSelect("GREATEST(CASE WHEN prestamo.estado = 'ANULADO' THEN 0 ELSE prestamo.monto_total - COALESCE(pagos_orden.total_pagado, 0) END, 0)", 'saldo_pendiente_orden');
    }
    let entities: PrestamoOrmEntity[];
    let raw: Array<Record<string, unknown>> = [];
    let total: number;
    if (incluyeCancelados) {
      if (filtros.ordenarPor) applyOrdering(query, filtros);
      else query.orderBy('fecha_cancelacion_orden', 'DESC', 'NULLS LAST').addOrderBy('prestamo.id', 'DESC');
      total = await query.clone().getCount();
      query.skip((filtros.pagina - 1) * filtros.limite).take(filtros.limite);
      const result = await query.getRawAndEntities();
      entities = result.entities;
      raw = result.raw as Array<Record<string, unknown>>;
    } else {
      applyOrdering(query, filtros).skip((filtros.pagina - 1) * filtros.limite).take(filtros.limite);
      [entities, total] = await query.getManyAndCount();
    }
    const loans = entities.map((entity, index) => {
      const loan = PrestamoMapper.toDomain(entity);
      if (incluyeCancelados) {
        const row = raw[index] ?? {};
        Object.assign(loan, {
          fechaCancelacion: serializeRawDateOnly(row.cancelacion_fecha),
          usuarioCancelacion: row.cancelacion_usuario_id == null ? null : { id: Number(row.cancelacion_usuario_id), nombreCompleto: String(row.cancelacion_usuario_nombre ?? '') },
        });
      }
      return loan;
    });
    if (!loans.length) return { datos: [], pagina: filtros.pagina, limite: filtros.limite, total, totalPaginas: Math.ceil(total / filtros.limite) };
    const ids = loans.map((loan) => loan.id!);
    const totals = await this.repository.manager.createQueryBuilder()
      .select('pago.prestamo_id', 'prestamo_id')
       .addSelect('SUM(pago.capital_aplicado)', 'capital_pagado')
       .addSelect('SUM(pago.monto)', 'total_pagado')
       .from('pago', 'pago')
         .where('pago.prestamo_id IN (:...ids)', { ids })
       .andWhere("pago.estado = 'REGISTRADO'")
      .groupBy('pago.prestamo_id')
      .getRawMany<{ prestamo_id: string; capital_pagado: string; total_pagado: string }>();
    const paidByLoan = new Map(totals.map((row) => [Number(row.prestamo_id), { capital: Number(row.capital_pagado ?? 0), total: Number(row.total_pagado ?? 0) }]));
      return { datos: loans.map((loan) => { const paid = paidByLoan.get(loan.id!) ?? { capital: 0, total: 0 }; const operativo = loan.estado !== 'ANULADO'; return Object.assign(loan, { capitalPendiente: operativo ? Math.max(0, loan.capital - paid.capital) : 0, saldoPendiente: operativo ? Math.max(loan.montoTotal - paid.total, 0) : 0 }); }), pagina: filtros.pagina, limite: filtros.limite, total, totalPaginas: Math.ceil(total / filtros.limite) };
  }
  async resumen(filtros: FiltrosPrestamos): Promise<PrestamosResumen> {
    const pagos = this.repository.manager.createQueryBuilder().subQuery()
      .select('pago.prestamo_id', 'prestamo_id')
        .addSelect('SUM(pago.monto)', 'recuperado')
       .from('pago', 'pago')
         .where("pago.estado = 'REGISTRADO'")
         .groupBy('pago.prestamo_id');
    const query = this.applyFilters(this.repository.createQueryBuilder('prestamo').leftJoin('prestamo.cliente', 'cliente'), filtros)
      .leftJoin(`(${pagos.getQuery()})`, 'pagos', 'pagos.prestamo_id = prestamo.id')
      .select('COUNT(prestamo.id)', 'total')
       .addSelect("COALESCE(SUM(CASE WHEN prestamo.estado <> 'ANULADO' THEN prestamo.capital ELSE 0 END), 0)", 'prestado')
       .addSelect("COALESCE(SUM(CASE WHEN prestamo.estado <> 'ANULADO' THEN prestamo.interes ELSE 0 END), 0)", 'ganancia')
       .addSelect("COALESCE(SUM(CASE WHEN prestamo.estado <> 'ANULADO' THEN COALESCE(pagos.recuperado, 0) ELSE 0 END), 0)", 'recuperado')
       .addSelect("COALESCE(SUM(CASE WHEN prestamo.estado <> 'ANULADO' THEN GREATEST(prestamo.monto_total - COALESCE(pagos.recuperado, 0), 0) ELSE 0 END), 0)", 'pendiente');
    const raw = await query.getRawOne<{ total: string; prestado: string; ganancia: string; recuperado: string; pendiente: string }>();
    return { total: Number(raw?.total ?? 0), prestado: Number(raw?.prestado ?? 0), ganancia: Number(raw?.ganancia ?? 0), recuperado: Number(raw?.recuperado ?? 0), pendiente: Number(raw?.pendiente ?? 0) };
  }
  async listarParaExportacion(filtros: FiltrosPrestamos): Promise<PrestamoParaExportacion[]> {
    const entities = await this.applyFilters(this.withRelations(), filtros).orderBy('prestamo.fecha_alta', 'DESC').addOrderBy('prestamo.id', 'DESC').getMany();
    if (!entities.length) return [];
    const ids = entities.map((entity) => entity.id);
     const totals = await this.repository.manager.createQueryBuilder().select('pago.prestamo_id', 'prestamo_id').addSelect('SUM(pago.monto)', 'recuperado').from('pago', 'pago').where('pago.prestamo_id IN (:...ids)', { ids }).andWhere("pago.estado = 'REGISTRADO'").groupBy('pago.prestamo_id').getRawMany<{ prestamo_id: string; recuperado: string }>();
    const recovered = new Map(totals.map((row) => [Number(row.prestamo_id), Number(row.recuperado)]));
    return entities.map((entity) => Object.assign(PrestamoMapper.toDomain(entity), { recuperado: recovered.get(entity.id) ?? 0 }));
  }

  private incobrableQuery(filtros: FiltrosIncobrablesDto, candidatos: boolean, manager?: EntityManager) {
    const fecha = filtros.fechaReferencia ?? economicDateOnly();
    const query = (manager?.getRepository(PrestamoOrmEntity) ?? this.repository).createQueryBuilder('prestamo').leftJoinAndSelect('prestamo.cliente', 'cliente').leftJoinAndSelect('prestamo.periodicidadPago', 'periodicidadPago').leftJoinAndSelect('prestamo.formaPago', 'formaPago').leftJoinAndSelect('prestamo.formaDesembolso', 'formaDesembolso');
    const paidLoan = '(SELECT COALESCE(SUM(p0.monto), 0) FROM pago p0 WHERE p0.prestamo_id = prestamo.id AND p0.estado = \'REGISTRADO\')';
    const paidPlan = '(SELECT COALESCE(SUM(p1.monto), 0) FROM pago p1 WHERE p1.plan_pago_id = pp.id AND p1.estado = \'REGISTRADO\')';
    if (candidatos) {
      query.where('prestamo.estado = :active', { active: EstadoPrestamo.ACTIVO })
        .andWhere(`prestamo.monto_total - ${paidLoan} > 0`)
        .andWhere(`EXISTS (SELECT 1 FROM plan_pago pp WHERE pp.prestamo_id = prestamo.id AND pp.fecha_vencimiento < :fecha AND pp.monto_programado - ${paidPlan} > 0)`, { fecha });
      query.addSelect(`(SELECT MIN(pp2.fecha_vencimiento) FROM plan_pago pp2 WHERE pp2.prestamo_id = prestamo.id AND pp2.fecha_vencimiento < :fecha AND pp2.monto_programado - (SELECT COALESCE(SUM(p2.monto), 0) FROM pago p2 WHERE p2.plan_pago_id = pp2.id AND p2.estado = 'REGISTRADO') > 0)`, 'incobrable_fecha_vencimiento');
      query.addSelect(`(SELECT MIN(pp3.monto_programado - (SELECT COALESCE(SUM(p3.monto), 0) FROM pago p3 WHERE p3.plan_pago_id = pp3.id AND p3.estado = 'REGISTRADO')) FROM plan_pago pp3 WHERE pp3.prestamo_id = prestamo.id AND pp3.fecha_vencimiento < :fecha AND pp3.monto_programado - (SELECT COALESCE(SUM(p4.monto), 0) FROM pago p4 WHERE p4.plan_pago_id = pp3.id AND p4.estado = 'REGISTRADO') > 0)`, 'incobrable_saldo_cuota');
    } else {
      query.where('prestamo.estado = :bad', { bad: EstadoPrestamo.INCOBRABLE });
      query.addSelect(`(SELECT h.fecha FROM prestamo_estado_historial h WHERE h.prestamo_id = prestamo.id AND h.estado_nuevo = :bad ORDER BY h.fecha DESC, h.id DESC LIMIT 1)`, 'incobrable_fecha');
      query.addSelect(`(SELECT h.observacion FROM prestamo_estado_historial h WHERE h.prestamo_id = prestamo.id AND h.estado_nuevo = :bad ORDER BY h.fecha DESC, h.id DESC LIMIT 1)`, 'incobrable_observacion');
      query.addSelect(`(SELECT MAX(p5.fecha) FROM pago p5 WHERE p5.prestamo_id = prestamo.id AND p5.estado = 'REGISTRADO')`, 'incobrable_ultimo_pago');
      query.setParameter('bad', EstadoPrestamo.INCOBRABLE);
    }
    query.addSelect(`(SELECT COALESCE(SUM(px.monto), 0) FROM pago px WHERE px.prestamo_id = prestamo.id AND px.estado = 'REGISTRADO')`, 'total_pagado');
    query.addSelect(`GREATEST(prestamo.monto_total - ${paidLoan}, 0)`, 'saldo_pendiente_orden');
    query.addSelect(`(SELECT COALESCE(SUM(px.capital_aplicado), 0) FROM pago px WHERE px.prestamo_id = prestamo.id AND px.estado = 'REGISTRADO')`, 'capital_pagado');
    applyClientSearch(query, filtros.buscar, 'incBuscarTerm');
    if (filtros.direccion?.trim()) query.andWhere('cliente.direccion ILIKE :incDireccion', { incDireccion: `%${filtros.direccion.trim()}%` });
    return { query, fecha };
  }

  private async listarIncobrablesBase(filtros: FiltrosIncobrablesDto, candidatos: boolean): Promise<IncobrablesPaginados> {
    const { query } = this.incobrableQuery(filtros, candidatos);
    const total = await query.clone().getCount();
    const direction = filtros.direccionOrden ?? 'DESC';
    const order = filtros.ordenarPor ?? (candidatos ? OrdenarIncobrablesPor.FECHA_VENCIMIENTO : OrdenarIncobrablesPor.FECHA_INCOBRABLE);
    const alias: Record<string, string> = { fechaVencimiento: 'incobrable_fecha_vencimiento', saldoPendiente: 'saldo_pendiente_orden', cliente: 'cliente.primer_apellido', fechaIncobrable: 'incobrable_fecha', id: 'prestamo.id' };
    query.orderBy(alias[order] ?? 'prestamo.id', direction).addOrderBy('prestamo.id', 'DESC').skip((filtros.pagina - 1) * filtros.limite).take(filtros.limite);
    const { entities, raw } = await query.getRawAndEntities();
    const rows = raw as Array<Record<string, unknown>>;
    const datos = entities.map((entity, index) => {
      const loan = PrestamoMapper.toDomain(entity);
      const row = rows[index] ?? {};
      const paid = Number(row.total_pagado ?? 0);
      const item = Object.assign(loan, { capitalPendiente: Math.max(loan.capital - Number(row.capital_pagado ?? 0), 0), saldoPendiente: Math.max(loan.montoTotal - paid, 0) }) as IncobrableListado;
      if (candidatos) Object.assign(item, { fechaVencimiento: row.incobrable_fecha_vencimiento, saldoCuota: Number(row.incobrable_saldo_cuota ?? 0), puedePasarAIncobrable: true, puedeReactivar: false });
      else { const date = row.incobrable_fecha ? String(row.incobrable_fecha).slice(0, 10) : undefined; Object.assign(item, { fechaIncobrable: date, observacionIncobrable: row.incobrable_observacion ?? null, diasEnEstado: date ? Math.max(0, Math.floor((Date.parse(`${economicDateOnly()}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000)) : 0, ultimaFechaPago: row.incobrable_ultimo_pago ? String(row.incobrable_ultimo_pago).slice(0, 10) : null, puedePasarAIncobrable: false, puedeReactivar: true }); }
      return item;
    });
    return { datos, pagina: filtros.pagina, limite: filtros.limite, total, totalPaginas: Math.ceil(total / filtros.limite) };
  }

  listarCandidatosIncobrables(filtros: FiltrosIncobrablesDto) { return this.listarIncobrablesBase(filtros, true); }
  listarIncobrables(filtros: FiltrosIncobrablesDto) { return this.listarIncobrablesBase(filtros, false); }
  async esElegibleParaIncobrable(id: number, fechaReferencia: string, manager?: EntityManager) { const { query } = this.incobrableQuery({ pagina: 1, limite: 1, fechaReferencia }, true, manager); return (await query.andWhere('prestamo.id = :eligibilityId', { eligibilityId: id }).getCount()) > 0; }

  async listarCandidatosAnulacion(filtros: FiltrosPrestamos): Promise<PrestamosPaginados> {
    const query = this.applyFilters(this.withRelations(), { ...filtros, estado: EstadoPrestamo.ACTIVO, estados: undefined });
    query.andWhere('prestamo.estado = :anulacionActivo', { anulacionActivo: EstadoPrestamo.ACTIVO })
      .andWhere("NOT EXISTS (SELECT 1 FROM pago p WHERE p.prestamo_id = prestamo.id AND p.estado IN ('REGISTRADO', 'ANULADO'))")
      .andWhere('NOT EXISTS (SELECT 1 FROM refinanciamiento r WHERE r.prestamo_origen_id = prestamo.id OR r.prestamo_nuevo_id = prestamo.id)')
      .andWhere("(SELECT COUNT(*) FROM movimiento_caja m WHERE m.prestamo_id = prestamo.id AND m.concepto = 'DESEMBOLSO_PRESTAMO' AND m.movimiento_reversado_id IS NULL) = 1");
    const total = await query.clone().getCount();
    query.orderBy('prestamo.fecha_alta', filtros.direccionOrden ?? 'DESC').addOrderBy('prestamo.id', 'DESC').skip((filtros.pagina - 1) * filtros.limite).take(filtros.limite);
    const loans = (await query.getMany()).map((entity) => PrestamoMapper.toDomain(entity));
    return { datos: loans.map((loan) => Object.assign(loan, { capitalPendiente: loan.capital, saldoPendiente: loan.montoTotal })), pagina: filtros.pagina, limite: filtros.limite, total, totalPaginas: Math.ceil(total / filtros.limite) };
  }

  async listarAnulados(filtros: FiltrosPrestamos): Promise<AnulacionesPaginadas> {
    const query = this.applyFilters(this.withRelations(), { ...filtros, estado: EstadoPrestamo.ANULADO, estados: undefined });
    query.andWhere('prestamo.estado = :anuladoEstado', { anuladoEstado: EstadoPrestamo.ANULADO })
      .addSelect("(SELECT h.fecha FROM prestamo_estado_historial h WHERE h.prestamo_id = prestamo.id AND h.estado_anterior = 'ACTIVO' AND h.estado_nuevo = 'ANULADO' ORDER BY h.id DESC LIMIT 1)", 'anulacion_fecha')
      .addSelect("(SELECT h.observacion FROM prestamo_estado_historial h WHERE h.prestamo_id = prestamo.id AND h.estado_anterior = 'ACTIVO' AND h.estado_nuevo = 'ANULADO' ORDER BY h.id DESC LIMIT 1)", 'anulacion_observacion')
      .addSelect("(SELECT u.id FROM prestamo_estado_historial h JOIN usuario u ON u.id = h.usuario_id WHERE h.prestamo_id = prestamo.id AND h.estado_anterior = 'ACTIVO' AND h.estado_nuevo = 'ANULADO' ORDER BY h.id DESC LIMIT 1)", 'anulacion_usuario_id')
      .addSelect("(SELECT u.nombre_completo FROM prestamo_estado_historial h JOIN usuario u ON u.id = h.usuario_id WHERE h.prestamo_id = prestamo.id AND h.estado_anterior = 'ACTIVO' AND h.estado_nuevo = 'ANULADO' ORDER BY h.id DESC LIMIT 1)", 'anulacion_usuario_nombre')
      .addSelect("(SELECT m.id FROM movimiento_caja m WHERE m.prestamo_id = prestamo.id AND m.concepto = 'DESEMBOLSO_PRESTAMO' ORDER BY m.id ASC LIMIT 1)", 'desembolso_id')
      .addSelect("(SELECT r.fecha FROM movimiento_caja r WHERE r.movimiento_reversado_id = (SELECT m.id FROM movimiento_caja m WHERE m.prestamo_id = prestamo.id AND m.concepto = 'DESEMBOLSO_PRESTAMO' ORDER BY m.id ASC LIMIT 1) ORDER BY r.id DESC LIMIT 1)", 'reverso_fecha')
      .addSelect("(SELECT r.id FROM movimiento_caja r WHERE r.movimiento_reversado_id = (SELECT m.id FROM movimiento_caja m WHERE m.prestamo_id = prestamo.id AND m.concepto = 'DESEMBOLSO_PRESTAMO' ORDER BY m.id ASC LIMIT 1) ORDER BY r.id DESC LIMIT 1)", 'reverso_id')
      .addSelect("(SELECT r.monto FROM movimiento_caja r WHERE r.movimiento_reversado_id = (SELECT m.id FROM movimiento_caja m WHERE m.prestamo_id = prestamo.id AND m.concepto = 'DESEMBOLSO_PRESTAMO' ORDER BY m.id ASC LIMIT 1) ORDER BY r.id DESC LIMIT 1)", 'reverso_monto');
    const total = await query.clone().getCount();
    query.orderBy('prestamo.fecha_alta', filtros.direccionOrden ?? 'DESC').addOrderBy('prestamo.id', 'DESC').skip((filtros.pagina - 1) * filtros.limite).take(filtros.limite);
    const { entities, raw } = await query.getRawAndEntities();
    const datos = entities.map((entity, index) => {
      const loan = PrestamoMapper.toDomain(entity);
      const row = raw[index] as Record<string, unknown>;
      return Object.assign(loan, { capitalPendiente: 0, saldoPendiente: 0, fechaAnulacion: row.anulacion_fecha ? String(row.anulacion_fecha).slice(0, 10) : '', observacionAnulacion: (row.anulacion_observacion as string | null) ?? null, movimientoDesembolsoId: row.desembolso_id == null ? null : Number(row.desembolso_id), movimientoReversoId: row.reverso_id == null ? null : Number(row.reverso_id), fechaReverso: row.reverso_fecha ? String(row.reverso_fecha).slice(0, 10) : null, montoReversado: row.reverso_monto == null ? null : Number(row.reverso_monto), usuarioAnulacion: row.anulacion_usuario_id == null ? null : { id: Number(row.anulacion_usuario_id), nombreCompleto: String(row.anulacion_usuario_nombre ?? '') } }) as AnulacionListado;
    });
    return { datos, pagina: filtros.pagina, limite: filtros.limite, total, totalPaginas: Math.ceil(total / filtros.limite) };
  }
}
