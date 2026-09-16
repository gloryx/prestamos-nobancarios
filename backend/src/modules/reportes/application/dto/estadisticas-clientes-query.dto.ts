import { IsEnum, IsOptional } from 'class-validator';

export enum OrdenEstadisticasClientes {
  CANTIDAD_PRESTAMOS = 'cantidadPrestamos',
  TOTAL_PRESTADO = 'totalPrestado',
  GANANCIA_COBRADA = 'gananciaCobrada',
}

export enum TopEstadisticasClientes {
  DIEZ = '10',
  VEINTE = '20',
  CINCUENTA = '50',
  TODOS = 'todos',
}

export class EstadisticasClientesQueryDto {
  @IsOptional()
  @IsEnum(OrdenEstadisticasClientes)
  orden: OrdenEstadisticasClientes = OrdenEstadisticasClientes.CANTIDAD_PRESTAMOS;

  @IsOptional()
  @IsEnum(TopEstadisticasClientes)
  top: TopEstadisticasClientes = TopEstadisticasClientes.DIEZ;
}
