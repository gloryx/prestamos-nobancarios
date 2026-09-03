import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PRESTAMO_REPOSITORY, PrestamoRepository } from '../../../prestamos/domain/repositories/prestamo.repository';
import { PAGO_REPOSITORY, PagoRepository } from '../../domain/repositories/pago.repository';
@Injectable()
export class ListarPagosPorPrestamoUseCase { constructor(@Inject(PAGO_REPOSITORY) private readonly pagos: PagoRepository, @Inject(PRESTAMO_REPOSITORY) private readonly prestamos: PrestamoRepository) {} async execute(id: number) { if (!(await this.prestamos.buscarPorId(id))) throw new NotFoundException('Préstamo no encontrado.'); return this.pagos.listarPorPrestamo(id); } }
