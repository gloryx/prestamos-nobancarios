import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PRESTAMO_REPOSITORY, PrestamoConRelaciones, PrestamoRepository } from '../../domain/repositories/prestamo.repository';
import { PrestamoAnulacionService } from '../services/prestamo-anulacion.service';
import { PLAN_PAGO_REPOSITORY, PlanPagoRepository } from '../../../planes-pago/domain/repositories/plan-pago.repository';
import { PlanPagoEditabilityService } from '../../../planes-pago/application/services/plan-pago-editability.service';
import { PAGO_REPOSITORY, PagoRepository } from '../../../pagos/domain/repositories/pago.repository';

export type PrestamoDetalle = PrestamoConRelaciones & {
  saldoFinanciero: number;
  totalPlanOperativoPendiente: number;
  diferenciaPlan: number;
  planRequiereAjuste: boolean;
};
@Injectable()
export class ObtenerPrestamoPorIdUseCase {
  constructor(@Inject(PRESTAMO_REPOSITORY) private readonly repository: PrestamoRepository, @Optional() private readonly anulacion?: PrestamoAnulacionService, @Optional() @InjectDataSource() private readonly dataSource?: DataSource, @Optional() @Inject(PLAN_PAGO_REPOSITORY) private readonly planes?: PlanPagoRepository, @Optional() private readonly planEditability?: PlanPagoEditabilityService, @Optional() @Inject(PAGO_REPOSITORY) private readonly pagos?: PagoRepository) {}
  async execute(id: number): Promise<PrestamoDetalle> {
    const value = await this.repository.buscarPorId(id);
    if (!value) throw new NotFoundException('Préstamo no encontrado.');
    if (this.anulacion && this.dataSource) value.puedeAnular = (await this.anulacion.calcular(this.dataSource.manager, [id])).get(id)?.puedeAnular ?? false;
    const [planes, pagos] = await Promise.all([this.planes?.buscarPorPrestamoId(id) ?? Promise.resolve([]), this.pagos?.listarPorPrestamo(id) ?? Promise.resolve([])]);
    const registeredTotalCents = pagos.filter((pago) => pago.estado === 'REGISTRADO').reduce((total, pago) => total + Math.round(pago.monto * 100), 0);
    const saldoCents = Math.max(0, Math.round(value.montoTotal * 100) - registeredTotalCents);
    const planCents = this.planEditability?.totalPlanOperativoPendiente(planes, pagos as any) ?? 0;
    const diferenciaCents = saldoCents - planCents;
    return Object.assign(value, { saldoFinanciero: saldoCents / 100, totalPlanOperativoPendiente: planCents / 100, diferenciaPlan: diferenciaCents / 100, planRequiereAjuste: diferenciaCents !== 0 });
  }
}
