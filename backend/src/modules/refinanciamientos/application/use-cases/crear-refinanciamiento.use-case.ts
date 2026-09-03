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

const date = (v: string) => new Date(`${v.slice(0, 10)}T00:00:00.000Z`);
const money = (v: number) => Math.round(v * 100) / 100;
@Injectable()
export class CrearRefinanciamientoUseCase {
  constructor(@InjectDataSource() private readonly dataSource: DataSource, private readonly caja: MovimientoCajaService, @Optional() private readonly history?: PrestamoEstadoHistorialService, @Optional() private readonly periods?: FinancialPeriodService) {}
  async execute(dto: CrearRefinanciamientoDto, actorUsuarioId?: number) {
    if (!actorUsuarioId) throw new BadRequestException('Se requiere una identidad autenticada para crear refinanciamientos.');
    return this.dataSource.transaction(async manager => {
      if (this.periods) await this.periods.assertOpen(manager, date(dto.fecha));
      await this.caja.validarActor(manager, actorUsuarioId);
      const origen = await manager.getRepository(PrestamoOrmEntity).createQueryBuilder('p').leftJoinAndSelect('p.cliente', 'cliente').leftJoinAndSelect('p.periodicidadPago', 'periodicidadPago').leftJoinAndSelect('p.formaPago', 'formaPago').where('p.id = :id', { id: dto.prestamoOrigenId }).setLock('pessimistic_write').getOne();
      if (!origen) throw new NotFoundException('Préstamo no encontrado.');
      if (origen.estado !== EstadoPrestamo.ACTIVO) throw new BadRequestException('Solo se pueden refinanciar préstamos activos.');
      const refRepo = manager.getRepository(RefinanciamientoOrmEntity);
      if (await refRepo.count({ where: { prestamoOrigenId: origen.id } })) throw new ConflictException('El préstamo ya fue refinanciado.');
      const totals = await manager.getRepository(PagoOrmEntity).createQueryBuilder('p').select('COALESCE(SUM(p.capital_aplicado), 0)', 'capital').addSelect('COALESCE(SUM(p.interes_aplicado), 0)', 'interes').where('p.prestamo_id = :id', { id: origen.id }).getRawOne<{ capital: string; interes: string }>();
      const capitalPendiente = money(Math.max(0, origen.capital - Number(totals?.capital ?? 0)));
      const interesPendiente = money(Math.max(0, origen.interes - Number(totals?.interes ?? 0)));
      if (capitalPendiente + interesPendiente <= 0) throw new BadRequestException('El préstamo no tiene saldo pendiente para refinanciar.');
      const cliente = await manager.getRepository(ClienteOrmEntity).findOne({ where: { id: origen.clienteId } });
      const periodicidad = await manager.getRepository(PeriodicidadPagoOrmEntity).findOne({ where: { id: dto.periodicidadPagoId } });
      const forma = await manager.getRepository(FormaPagoOrmEntity).findOne({ where: { id: dto.formaPagoId } });
      if (!cliente) throw new NotFoundException('Préstamo no encontrado.');
      if (!periodicidad) throw new NotFoundException('Periodicidad de pago no encontrada.'); if (!periodicidad.activo) throw new BadRequestException('La periodicidad de pago seleccionada está inactiva.');
      if (!forma) throw new NotFoundException('Forma de pago no encontrada.'); if (!forma.activo) throw new BadRequestException('La forma de pago seleccionada está inactiva.');
      const dineroNuevoDesembolsado = money(dto.montoNuevoDesembolsado); const interesNuevo = money(dto.interesNuevo);
      const capitalPrestamoNuevo = money(capitalPendiente + dineroNuevoDesembolsado); const interesTotalPrestamoNuevo = money(interesPendiente + interesNuevo); const montoTotalPrestamoNuevo = money(capitalPrestamoNuevo + interesTotalPrestamoNuevo);
      const nuevo = new Prestamo(null, origen.clienteId, dto.periodicidadPagoId, dto.formaPagoId, date(dto.fecha), capitalPrestamoNuevo, interesTotalPrestamoNuevo, montoTotalPrestamoNuevo, dineroNuevoDesembolsado, dto.cantidadPagos, dto.planPersonalizado, EstadoPrestamo.ACTIVO, dto.observaciones?.trim() || null, new Date(), new Date());
      const savedNuevo = await manager.getRepository(PrestamoOrmEntity).save(PrestamoMapper.toOrm(nuevo));
      const nuevoDomain = Object.assign(new Prestamo(savedNuevo.id, savedNuevo.clienteId, savedNuevo.periodicidadPagoId, savedNuevo.formaPagoId, date(savedNuevo.fechaAlta), savedNuevo.capital, savedNuevo.interes, savedNuevo.montoTotal, savedNuevo.montoDesembolsado, savedNuevo.cantidadPagos, savedNuevo.planPersonalizado, savedNuevo.estado, savedNuevo.observaciones, savedNuevo.fechaCreacion, savedNuevo.fechaActualizacion), { cliente: { id: cliente.id, nombre: '', identificacion: cliente.identificacion }, periodicidadPago: { id: periodicidad.id, nombre: periodicidad.nombre }, formaPago: { id: forma.id, nombre: forma.nombre } });
      const planes = dto.planPersonalizado ? convertirYValidarCuotas(nuevoDomain, dto.cuotas ?? []) : GeneradorPlanPago.generar(nuevoDomain);
      await manager.getRepository(PlanPagoOrmEntity).save(planes.map(PlanPagoMapper.toOrm));
       const previousState = origen.estado; origen.estado = EstadoPrestamo.REFINANCIADO; await manager.getRepository(PrestamoOrmEntity).save(origen);
       if (this.history) { await this.history.registrar(manager, origen.id, previousState, EstadoPrestamo.REFINANCIADO, date(dto.fecha), actorUsuarioId, dto.observaciones); await this.history.registrar(manager, savedNuevo.id, null, EstadoPrestamo.ACTIVO, date(dto.fecha), actorUsuarioId, dto.observaciones); }
       const savedRef = await refRepo.save(RefinanciamientoMapper.toOrm(Refinanciamiento.crear({ prestamoOrigenId: origen.id, prestamoNuevoId: savedNuevo.id, fecha: date(dto.fecha), capitalPendiente, interesPendiente, montoRefinanciado: money(capitalPendiente + interesPendiente), interesNuevo, observaciones: dto.observaciones })));
       if (dineroNuevoDesembolsado > 0) await this.caja.automatico(manager, { tipo: TipoMovimientoCaja.SALIDA, concepto: ConceptoMovimientoCaja.DESEMBOLSO_REFINANCIAMIENTO, monto: dineroNuevoDesembolsado, fecha: date(dto.fecha), observaciones: dto.observaciones?.trim() || null, pagoId: null, prestamoId: savedNuevo.id, refinanciamientoId: savedRef.id, movimientoReversadoId: null, usuarioId: actorUsuarioId });
      return RefinanciamientoMapper.toDomain(Object.assign(savedRef, { prestamoOrigen: origen, prestamoNuevo: savedNuevo }));
    });
  }
}
