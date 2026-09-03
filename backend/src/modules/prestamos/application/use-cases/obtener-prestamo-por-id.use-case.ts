import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PRESTAMO_REPOSITORY, PrestamoConRelaciones, PrestamoRepository } from '../../domain/repositories/prestamo.repository';
@Injectable()
export class ObtenerPrestamoPorIdUseCase {
  constructor(@Inject(PRESTAMO_REPOSITORY) private readonly repository: PrestamoRepository) {}
  async execute(id: number): Promise<PrestamoConRelaciones> { const value = await this.repository.buscarPorId(id); if (!value) throw new NotFoundException('Préstamo no encontrado.'); return value; }
}
