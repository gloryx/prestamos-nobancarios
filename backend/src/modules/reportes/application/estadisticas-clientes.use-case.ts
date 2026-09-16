import { Inject, Injectable } from '@nestjs/common';
import { EstadisticasClientesQueryDto, OrdenEstadisticasClientes, TopEstadisticasClientes } from './dto/estadisticas-clientes-query.dto';
import { ESTADISTICAS_CLIENTES_REPOSITORY, EstadisticasClientesRepository } from '../domain/repositories/estadisticas-clientes.repository';

@Injectable()
export class EstadisticasClientesUseCase {
  constructor(@Inject(ESTADISTICAS_CLIENTES_REPOSITORY) private readonly repository: EstadisticasClientesRepository) {}

  async execute(query: EstadisticasClientesQueryDto) {
    const orden = query.orden ?? OrdenEstadisticasClientes.CANTIDAD_PRESTAMOS;
    const top = query.top ?? TopEstadisticasClientes.DIEZ;
    const rows = await this.repository.listar();
    const metric = orden as keyof Pick<typeof rows[number], 'cantidadPrestamos' | 'totalPrestado' | 'gananciaCobrada'>;
    rows.sort((a, b) => b[metric] - a[metric] || a.clienteId - b.clienteId);
    const limit = top === TopEstadisticasClientes.TODOS ? rows.length : Number(top);
    const datos = rows.slice(0, limit).map((row, index) => ({ posicion: index + 1, ...row }));
    return { orden, top, datos };
  }
}
