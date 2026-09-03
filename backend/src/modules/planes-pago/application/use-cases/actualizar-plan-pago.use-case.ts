import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PAGO_REPOSITORY, PagoRepository } from '../../../pagos/domain/repositories/pago.repository';
import { PRESTAMO_REPOSITORY, PrestamoRepository } from '../../../prestamos/domain/repositories/prestamo.repository';
import { EstadoPrestamo } from '../../../prestamos/domain/enums/estado-prestamo.enum';
import { PLAN_PAGO_REPOSITORY, PlanPagoRepository } from '../../domain/repositories/plan-pago.repository';
import { PlanPagoPersonalizadoDto } from '../dto/plan-pago-personalizado.dto';
import { convertirYValidarCuotas } from './validar-plan-pago';

@Injectable()
export class ActualizarPlanPagoUseCase {
  constructor(@Inject(PRESTAMO_REPOSITORY) private readonly prestamos: PrestamoRepository, @Inject(PLAN_PAGO_REPOSITORY) private readonly planes: PlanPagoRepository, @Inject(PAGO_REPOSITORY) private readonly pagos: PagoRepository) {}
  async execute(prestamoId: number, dto: PlanPagoPersonalizadoDto) {
    const prestamo = await this.prestamos.buscarPorId(prestamoId);
    if (!prestamo) throw new NotFoundException('Préstamo no encontrado.');
    if (prestamo.estado !== EstadoPrestamo.ACTIVO) throw new BadRequestException('Solo se puede modificar el plan de un préstamo activo.');
    if (await this.pagos.existePagoParaPrestamo(prestamoId)) throw new BadRequestException('El plan de pago no puede modificarse porque el préstamo ya tiene pagos registrados.');
    if (!dto.cuotas?.length) throw new BadRequestException('El plan de pago debe contener cuotas.');
    if (!(await this.planes.existePlanParaPrestamo(prestamoId))) throw new NotFoundException('Plan de pago no encontrado.');
    return this.planes.reemplazarPlan(convertirYValidarCuotas(prestamo, dto.cuotas), prestamoId);
  }
}
