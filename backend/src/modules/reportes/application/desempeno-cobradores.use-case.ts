import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DESEMPENO_COBRADORES_REPOSITORY, DesempenoCobradoresRepository } from '../domain/repositories/desempeno-cobradores.repository';
import type { DesempenoCobradoresQueryDto } from './dto/desempeno-cobradores-query.dto';

const money = (value: number) => Math.round((Number(value) || 0) * 100) / 100;
const percentage = (value: number, total: number) => total > 0 ? money((value / total) * 100) : 0;

export type DesempenoCobradoresReport = {
  fechaDesde: string;
  fechaHasta: string;
  totales: {
    cantidadPagos: number;
    totalRecibido: number;
    capitalAplicado: number;
    interesAplicado: number;
    cantidadCobradores: number;
  };
  cobradores: Array<{
    cobradorId: number | null;
    cobradorNombre: string;
    cantidadPagos: number;
    montoRecibido: number;
    capitalAplicado: number;
    interesAplicado: number;
    cantidadClientes: number;
    cantidadPrestamos: number;
    promedioPorPago: number;
    participacionMonto: number;
  }>;
};

@Injectable()
export class DesempenoCobradoresUseCase {
  constructor(@Inject(DESEMPENO_COBRADORES_REPOSITORY) private readonly repository: DesempenoCobradoresRepository) {}

  async execute(query: DesempenoCobradoresQueryDto): Promise<DesempenoCobradoresReport> {
    if (query.fechaDesde > query.fechaHasta) throw new BadRequestException('fechaDesde no puede ser posterior a fechaHasta.');
    const filters = { fechaDesde: query.fechaDesde, fechaHasta: query.fechaHasta, cobradorId: query.cobradorId, formaPagoId: query.formaPagoId };
    const [rows, total] = await Promise.all([this.repository.agrupar(filters), this.repository.totales(filters)]);
    const totalRecibido = money(total.totalRecibido);
    return {
      fechaDesde: query.fechaDesde,
      fechaHasta: query.fechaHasta,
      totales: { cantidadPagos: Number(total.cantidadPagos) || 0, totalRecibido, capitalAplicado: money(total.capitalAplicado), interesAplicado: money(total.interesAplicado), cantidadCobradores: Number(total.cantidadCobradores) || 0 },
      cobradores: rows.map((row) => {
        const montoRecibido = money(row.montoRecibido);
        const cantidadPagos = Number(row.cantidadPagos) || 0;
        return { cobradorId: row.cobradorId, cobradorNombre: row.cobradorNombre ?? 'Sin cobrador', cantidadPagos, montoRecibido, capitalAplicado: money(row.capitalAplicado), interesAplicado: money(row.interesAplicado), cantidadClientes: Number(row.cantidadClientes) || 0, cantidadPrestamos: Number(row.cantidadPrestamos) || 0, promedioPorPago: cantidadPagos > 0 ? money(montoRecibido / cantidadPagos) : 0, participacionMonto: percentage(montoRecibido, totalRecibido) };
      }),
    };
  }
}
