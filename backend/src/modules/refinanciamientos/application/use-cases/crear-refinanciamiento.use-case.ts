import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ClienteOrmEntity } from '../../../clientes/infrastructure/persistence/typeorm/cliente.orm-entity';
import { FormaPagoOrmEntity } from '../../../formas-pago/infrastructure/persistence/typeorm/forma-pago.orm-entity';
import { PeriodicidadPagoOrmEntity } from '../../../periodicidades-pago/infrastructure/persistence/typeorm/periodicidad-pago.orm-entity';
import { EstadoPrestamo } from '../../../prestamos/domain/enums/estado-prestamo.enum';
import { Prestamo } from '../../../prestamos/domain/entities/prestamo';
import { PrestamoOrmEntity } from '../../../prestamos/infrastructure/persistence/typeorm/prestamo.orm-entity';
import { PrestamoMapper } from '../../../prestamos/infrastructure/persistence/typeorm/prestamo.mapper';
import { PagoOrmEntity } from '../../../pagos/infrastructure/persistence/typeorm/pago.orm-entity';
import { PlanPagoOrmEntity } from '../../../planes-pago/infrastructure/persistence/typeorm/plan-pago.orm-entity';
import { PlanPagoMapper } from '../../../planes-pago/infrastructure/persistence/typeorm/plan-pago.mapper';
import { GeneradorPlanPago } from '../../../planes-pago/domain/services/generador-plan-pago';
import { convertirYValidarCuotas } from '../../../planes-pago/application/use-cases/validar-plan-pago';
import { Refinanciamiento } from '../../domain/entities/refinanciamiento';
import { RefinanciamientoOrmEntity } from '../../infrastructure/persistence/typeorm/refinanciamiento.orm-entity';
import { RefinanciamientoMapper } from '../../infrastructure/persistence/typeorm/refinanciamiento.mapper';
import { CrearRefinanciamientoDto } from '../dto/crear-refinanciamiento.dto';
import { MovimientoCajaService } from '../../../movimientos-caja/application/services/movimiento-caja.service';
import { ConceptoMovimientoCaja } from '../../../movimientos-caja/domain/enums/concepto-movimiento-caja.enum';
import { TipoMovimientoCaja } from '../../../movimientos-caja/domain/enums/tipo-movimiento-caja.enum';
import { FinancialPeriodService } from '../../../cierre-financiero/application/financial-period.service';
import { PrestamoEstadoHistorialService } from '../../../prestamos/application/services/prestamo-estado-historial.service';
import { PrestamoReferences } from '../../../prestamos/application/use-cases/prestamo-references';
import { calcularElegibilidadRefinanciamiento } from '../services/calcular-elegibilidad-refinanciamiento';

const normalizeEconomicDate = (value: string | Date): Date => {
  let dateOnly: string;
  if (typeof value === 'string') {
    dateOnly = value.slice(0, 10);
  } else if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const pad = (part: number) => String(part).padStart(2, '0');
    dateOnly = `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  } else {
    throw new BadRequestException('La fecha económica no es válida.');
  }

  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!parts) throw new BadRequestException('La fecha económica no es válida.');
  const normalized = new Date(`${dateOnly}T00:00:00.000Z`);
  if (Number.isNaN(normalized.getTime()) || normalized.getUTCFullYear() !== Number(parts[1]) || normalized.getUTCMonth() + 1 !== Number(parts[2]) || normalized.getUTCDate() !== Number(parts[3])) throw new BadRequestException('La fecha económica no es válida.');
  return normalized;
};
const money = (v: number) => Math.round(v * 100) / 100;
@Injectable()
export class CrearRefinanciamientoUseCase {
  constructor(@InjectDataSource() private readonly dataSource: DataSource, private readonly caja: MovimientoCajaService, @Optional() private readonly history?: PrestamoEstadoHistorialService, @Optional() private readonly periods?: FinancialPeriodService, @Optional() private readonly references?: PrestamoReferences) {}
  async execute(dto: CrearRefinanciamientoDto, actorUsuarioId?: number) {
    if (!actorUsuarioId) throw new BadRequestException('Se requiere una identidad autenticada para crear refinanciamientos.');
    return this.dataSource.transaction(async manager => {
      if (this.periods) await this.periods.assertOpen(manager, normalizeEconomicDate(dto.fecha));
      await this.caja.validarActor(manager, actorUsuarioId);
      const origen = await manager.getRepository(PrestamoOrmEntity).createQueryBuilder('p').leftJoinAndSelect('p.cliente', 'cliente').leftJoinAndSelect('p.periodicidadPago', 'periodicidadPago').leftJoinAndSelect('p.formaPago', 'formaPago').where('p.id = :id', { id: dto.prestamoOrigenId }).setLock('pessimistic_write', undefined, ['p']).getOne();
      if (!origen) throw new NotFoundException('Préstamo no encontrado.');
      if (origen.estado !== EstadoPrestamo.ACTIVO) throw new BadRequestException('Solo se pueden refinanciar préstamos activos.');
      const fechaLimiteRaw = await manager.getRepository(PlanPagoOrmEntity).createQueryBuilder('plan')
        .select('MAX(plan.fecha_vencimiento)', 'fechaLimiteContractualOrigen')
        .where('plan.prestamo_id = :prestamoId', { prestamoId: origen.id })
        .getRawOne<{ fechaLimiteContractualOrigen: string | Date | null }>();
      if (!fechaLimiteRaw?.fechaLimiteContractualOrigen) throw new BadRequestException('No se puede determinar la fecha límite contractual del préstamo origen.');
      const fechaLimiteContractualOrigen = normalizeEconomicDate(fechaLimiteRaw.fechaLimiteContractualOrigen);
      const refRepo = manager.getRepository(RefinanciamientoOrmEntity);
      if (await refRepo.count({ where: { prestamoOrigenId: origen.id } })) throw new ConflictException('El préstamo ya fue refinanciado.');
      const totals = await manager.getRepository(PagoOrmEntity).createQueryBuilder('p').select('COALESCE(SUM(p.monto), 0)', 'totalPagado').where('p.prestamo_id = :id', { id: origen.id }).andWhere('p.estado = :state', { state: 'REGISTRADO' }).getRawOne<{ totalPagado: string }>();
      const totalPagado = money(Number(totals?.totalPagado ?? 0));
       const calculo = calcularElegibilidadRefinanciamiento({ estado: origen.estado, capital: origen.capital, interes: origen.interes, totalPagado });
       if (calculo.interesPendienteParaRefinanciar > 0) throw new BadRequestException(`No se puede refinanciar el préstamo porque el interés pactado aún no ha sido cubierto completamente. Monto pendiente: ${calculo.interesPendienteParaRefinanciar}.`);
       const capitalPendienteRefinanciable = calculo.capitalPendienteRefinanciable;
       if (capitalPendienteRefinanciable <= 0) throw new BadRequestException('El préstamo no tiene saldo pendiente para refinanciar.');
       const dineroNuevoDesembolsado = money(dto.montoNuevoDesembolsado); const interesNuevo = money(dto.interesNuevo);
       const formaDesembolsoId = dineroNuevoDesembolsado > 0 ? dto.formaDesembolsoId : null;
       if (dineroNuevoDesembolsado > 0 && formaDesembolsoId == null) throw new BadRequestException('La forma de desembolso es obligatoria cuando existe dinero nuevo.');
       let cliente: { id: number; identificacion?: string };
       let periodicidad: { id: number; nombre: string };
       let forma: { id: number; nombre: string };
       let formaDesembolso: { id: number; nombre: string } | null;
       if (this.references) {
         const validated = await this.references.validarEnTransaccion(manager, origen.clienteId, dto.periodicidadPagoId, dto.formaPagoId, formaDesembolsoId);
         cliente = validated.cliente;
         periodicidad = validated.periodicidadPago;
         forma = validated.formaPago;
         formaDesembolso = validated.formaDesembolso;
       } else {
         const clienteEntity = await manager.getRepository(ClienteOrmEntity).findOne({ where: { id: origen.clienteId } });
         const periodicidadEntity = await manager.getRepository(PeriodicidadPagoOrmEntity).findOne({ where: { id: dto.periodicidadPagoId } });
         const formaEntity = await manager.getRepository(FormaPagoOrmEntity).findOne({ where: { id: dto.formaPagoId } });
         const formaDesembolsoEntity = formaDesembolsoId == null ? null : await manager.getRepository(FormaPagoOrmEntity).findOne({ where: { id: formaDesembolsoId } });
         if (!clienteEntity) throw new NotFoundException('Préstamo no encontrado.');
         if (!periodicidadEntity) throw new NotFoundException('Periodicidad de pago no encontrada.'); if (!periodicidadEntity.activo) throw new BadRequestException('La periodicidad de pago seleccionada está inactiva.');
         if (!formaEntity) throw new NotFoundException('Forma de pago no encontrada.'); if (!formaEntity.activo) throw new BadRequestException('La forma de pago seleccionada está inactiva.');
         if (formaDesembolsoId != null && !formaDesembolsoEntity) throw new NotFoundException('Forma de desembolso no encontrada.');
         if (formaDesembolsoId != null && !formaDesembolsoEntity!.activo) throw new BadRequestException('La forma de desembolso seleccionada está inactiva.');
         cliente = { id: clienteEntity.id, identificacion: clienteEntity.identificacion };
         periodicidad = { id: periodicidadEntity.id, nombre: periodicidadEntity.nombre };
         forma = { id: formaEntity.id, nombre: formaEntity.nombre };
         formaDesembolso = formaDesembolsoEntity ? { id: formaDesembolsoEntity.id, nombre: formaDesembolsoEntity.nombre } : null;
       }
        const capitalPrestamoNuevo = money(capitalPendienteRefinanciable + dineroNuevoDesembolsado); const interesTotalPrestamoNuevo = interesNuevo; const montoTotalPrestamoNuevo = money(capitalPrestamoNuevo + interesTotalPrestamoNuevo);
       const nuevo = new Prestamo(null, origen.clienteId, dto.periodicidadPagoId, dto.formaPagoId, formaDesembolsoId ?? null, normalizeEconomicDate(dto.fecha), capitalPrestamoNuevo, interesTotalPrestamoNuevo, montoTotalPrestamoNuevo, dineroNuevoDesembolsado, dto.cantidadPagos, dto.planPersonalizado, EstadoPrestamo.ACTIVO, dto.observaciones?.trim() || null, new Date(), new Date());
      const savedNuevo = await manager.getRepository(PrestamoOrmEntity).save(PrestamoMapper.toOrm(nuevo));
       const nuevoDomain = Object.assign(new Prestamo(savedNuevo.id, savedNuevo.clienteId, savedNuevo.periodicidadPagoId, savedNuevo.formaPagoId, savedNuevo.formaDesembolsoId ?? null, normalizeEconomicDate(savedNuevo.fechaAlta), savedNuevo.capital, savedNuevo.interes, savedNuevo.montoTotal, savedNuevo.montoDesembolsado, savedNuevo.cantidadPagos, savedNuevo.planPersonalizado, savedNuevo.estado, savedNuevo.observaciones, savedNuevo.fechaCreacion, savedNuevo.fechaActualizacion), { cliente: { id: cliente.id, nombre: '', identificacion: cliente.identificacion }, periodicidadPago: periodicidad, formaPago: forma, formaDesembolso });
      const planes = dto.planPersonalizado ? convertirYValidarCuotas(nuevoDomain, dto.cuotas ?? []) : GeneradorPlanPago.generar(nuevoDomain);
      await manager.getRepository(PlanPagoOrmEntity).save(planes.map(PlanPagoMapper.toOrm));
       const previousState = origen.estado; origen.estado = EstadoPrestamo.REFINANCIADO; await manager.getRepository(PrestamoOrmEntity).save(origen);
        if (this.history) { await this.history.registrar(manager, origen.id, previousState, EstadoPrestamo.REFINANCIADO, normalizeEconomicDate(dto.fecha), actorUsuarioId, dto.observaciones); await this.history.registrar(manager, savedNuevo.id, null, EstadoPrestamo.ACTIVO, normalizeEconomicDate(dto.fecha), actorUsuarioId, dto.observaciones); }
         const savedRef = await refRepo.save(RefinanciamientoMapper.toOrm(Refinanciamiento.crear({ prestamoOrigenId: origen.id, prestamoNuevoId: savedNuevo.id, fecha: normalizeEconomicDate(dto.fecha), capitalPendiente: capitalPendienteRefinanciable, interesPendiente: 0, montoRefinanciado: capitalPendienteRefinanciable, interesNuevo, observaciones: dto.observaciones, fechaLimiteContractualOrigen })));
        if (dineroNuevoDesembolsado > 0) await this.caja.automatico(manager, { tipo: TipoMovimientoCaja.SALIDA, concepto: ConceptoMovimientoCaja.DESEMBOLSO_REFINANCIAMIENTO, monto: dineroNuevoDesembolsado, fecha: normalizeEconomicDate(dto.fecha), observaciones: dto.observaciones?.trim() || null, pagoId: null, formaPagoId: formaDesembolsoId, prestamoId: savedNuevo.id, refinanciamientoId: savedRef.id, movimientoReversadoId: null, usuarioId: actorUsuarioId });
      return RefinanciamientoMapper.toDomain(Object.assign(savedRef, { prestamoOrigen: origen, prestamoNuevo: savedNuevo }));
    });
  }
}
