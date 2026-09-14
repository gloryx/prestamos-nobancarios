import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PRESTAMO_REPOSITORY, PrestamoConRelaciones, PrestamoRepository } from '../../domain/repositories/prestamo.repository';
import { PrestamoAnulacionService } from '../services/prestamo-anulacion.service';
@Injectable()
export class ObtenerPrestamoPorIdUseCase {
  constructor(@Inject(PRESTAMO_REPOSITORY) private readonly repository: PrestamoRepository, @Optional() private readonly anulacion?: PrestamoAnulacionService, @Optional() @InjectDataSource() private readonly dataSource?: DataSource) {}
  async execute(id: number): Promise<PrestamoConRelaciones> { const value = await this.repository.buscarPorId(id); if (!value) throw new NotFoundException('Préstamo no encontrado.'); if (this.anulacion && this.dataSource) value.puedeAnular = (await this.anulacion.calcular(this.dataSource.manager, [id])).get(id)?.puedeAnular ?? false; return value; }
}
