import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { aggregateFlujoPrestamos, totalFlujoPrestamos } from './flujo-prestamos-aggregation';
import type { FlujoPrestamosRepository } from '../domain/repositories/flujo-prestamos.repository';
import { FLUJO_PRESTAMOS_REPOSITORY } from '../domain/repositories/flujo-prestamos.repository';
import type { FlujoPrestamosQueryDto } from './dto/flujo-prestamos-query.dto';

@Injectable()
export class FlujoPrestamosUseCase {
  constructor(@Inject(FLUJO_PRESTAMOS_REPOSITORY) private readonly repository: FlujoPrestamosRepository) {}
  async execute(query: FlujoPrestamosQueryDto) { if (query.desde > query.hasta) throw new BadRequestException('El período desde debe ser menor o igual que hasta.'); const meses = aggregateFlujoPrestamos(query.desde, query.hasta, await this.repository.pagos(query.desde, query.hasta), await this.repository.desembolsos(query.desde, query.hasta)); const anuales: Record<string, ReturnType<typeof totalFlujoPrestamos>> = {}; for (const year of new Set(meses.map((row) => row.anio))) anuales[String(year)] = totalFlujoPrestamos(meses.filter((row) => row.anio === year)); return { desde: query.desde, hasta: query.hasta, meses, total: totalFlujoPrestamos(meses), anuales }; }
}
