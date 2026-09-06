import { Inject, Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DatosPrestamo, Prestamo } from '../../domain/entities/prestamo';
import { PRESTAMO_REPOSITORY, PrestamoConRelaciones, PrestamoRepository } from '../../domain/repositories/prestamo.repository';
import { CrearPrestamoDto } from '../dto/crear-prestamo.dto';
import { PrestamoReferences } from './prestamo-references';
import { MovimientoCajaService } from '../../../movimientos-caja/application/services/movimiento-caja.service';
import { TipoMovimientoCaja } from '../../../movimientos-caja/domain/enums/tipo-movimiento-caja.enum';
import { ConceptoMovimientoCaja } from '../../../movimientos-caja/domain/enums/concepto-movimiento-caja.enum';
import { PrestamoOrmEntity } from '../../infrastructure/persistence/typeorm/prestamo.orm-entity';
import { PrestamoMapper } from '../../infrastructure/persistence/typeorm/prestamo.mapper';
import { PLAN_PAGO_REPOSITORY, PlanPagoRepository } from '../../../planes-pago/domain/repositories/plan-pago.repository';
import { GeneradorPlanPago } from '../../../planes-pago/domain/services/generador-plan-pago';
import { convertirYValidarCuotas } from '../../../planes-pago/application/use-cases/validar-plan-pago';
import { FinancialPeriodService } from '../../../cierre-financiero/application/financial-period.service';
import { PrestamoEstadoHistorialService } from '../services/prestamo-estado-historial.service';

const datos = (dto: CrearPrestamoDto): DatosPrestamo => ({ ...dto, fechaAlta: new Date(`${dto.fechaAlta.slice(0, 10)}T00:00:00.000Z`) });
@Injectable()
export class CrearPrestamoUseCase {
  constructor(@Inject(PRESTAMO_REPOSITORY) private readonly repository: PrestamoRepository, private readonly references: PrestamoReferences, @InjectDataSource() private readonly dataSource: DataSource, private readonly caja: MovimientoCajaService, @Inject(PLAN_PAGO_REPOSITORY) private readonly planes: PlanPagoRepository, @Optional() private readonly history?: PrestamoEstadoHistorialService, @Optional() private readonly periods?: FinancialPeriodService) {}
  async execute(dto: CrearPrestamoDto, actorUsuarioId?: number): Promise<PrestamoConRelaciones> { if(!actorUsuarioId) throw new UnauthorizedException('Se requiere una identidad autenticada para crear préstamos.'); const value=datos(dto); const id=await this.dataSource.transaction(async manager=>{ if (this.periods) await this.periods.assertOpen(manager,value.fechaAlta); const refs=await this.references.validarEnTransaccion(manager,value.clienteId,value.periodicidadPagoId,value.formaPagoId,value.formaDesembolsoId); const saved=await manager.getRepository(PrestamoOrmEntity).save(PrestamoMapper.toOrm(Prestamo.crear(value))); if (this.history) await this.history.registrar(manager, saved.id, null, saved.estado, value.fechaAlta, actorUsuarioId, value.observaciones); if (!this.planes) throw new Error('Plan de pago no configurado.'); const domain=Object.assign(Prestamo.crear(value), { id: saved.id, cliente: refs.cliente, periodicidadPago: refs.periodicidadPago, formaPago: refs.formaPago, formaDesembolso: refs.formaDesembolso }); const planes=value.planPersonalizado ? convertirYValidarCuotas(domain, dto.cuotas ?? []) : GeneradorPlanPago.generar(domain); await this.planes.guardarMuchosEnTransaccion(manager, planes, saved.id, value.planPersonalizado); if(saved.montoDesembolsado>0) await this.caja.automatico(manager,{tipo:TipoMovimientoCaja.SALIDA,concepto:ConceptoMovimientoCaja.DESEMBOLSO_PRESTAMO,monto:saved.montoDesembolsado,fecha:value.fechaAlta,observaciones:value.observaciones??null,pagoId:null,formaPagoId:value.formaDesembolsoId,prestamoId:saved.id,refinanciamientoId:null,movimientoReversadoId:null,usuarioId:actorUsuarioId}); return saved.id;}); const result=await this.repository.buscarPorId(id); if(!result) throw new Error('No se pudo recuperar el préstamo creado.'); return result; }
}
