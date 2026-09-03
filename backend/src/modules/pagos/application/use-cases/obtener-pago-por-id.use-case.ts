import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PAGO_REPOSITORY, PagoConRelaciones, PagoRepository } from '../../domain/repositories/pago.repository';
@Injectable()
export class ObtenerPagoPorIdUseCase { constructor(@Inject(PAGO_REPOSITORY) private readonly pagos: PagoRepository) {} async execute(id: number): Promise<PagoConRelaciones> { const pago = await this.pagos.buscarPorId(id); if (!pago) throw new NotFoundException('Pago no encontrado.'); return pago; } }
