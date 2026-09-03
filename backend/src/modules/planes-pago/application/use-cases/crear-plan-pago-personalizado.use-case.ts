import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PRESTAMO_REPOSITORY, PrestamoRepository } from '../../../prestamos/domain/repositories/prestamo.repository';
import { EstadoPrestamo } from '../../../prestamos/domain/enums/estado-prestamo.enum';
import { PLAN_PAGO_REPOSITORY, PlanPagoRepository } from '../../domain/repositories/plan-pago.repository';
import { PlanPagoPersonalizadoDto } from '../dto/plan-pago-personalizado.dto';
import { convertirYValidarCuotas } from './validar-plan-pago';

@Injectable()
export class CrearPlanPagoPersonalizadoUseCase {
  constructor(@Inject(PRESTAMO_REPOSITORY) private readonly prestamos: PrestamoRepository, @Inject(PLAN_PAGO_REPOSITORY) private readonly planes: PlanPagoRepository) {}
  async execute(prestamoId: number, dto: PlanPagoPersonalizadoDto) {
    const prestamo = await this.prestamos.buscarPorId(prestamoId);
    if (!prestamo) throw new NotFoundException('Préstamo no encontrado.');
    if (prestamo.estado !== EstadoPrestamo.ACTIVO) throw new BadRequestException('Solo se puede generar el plan de pago de un préstamo activo.');
    if (await this.planes.existePlanParaPrestamo(prestamoId)) throw new ConflictException('El préstamo ya tiene un plan de pago.');
    if (!dto.cuotas?.length) throw new BadRequestException('El plan de pago debe contener cuotas.');
    return this.planes.guardarMuchos(convertirYValidarCuotas(prestamo, dto.cuotas), prestamoId, true);
  }
}
