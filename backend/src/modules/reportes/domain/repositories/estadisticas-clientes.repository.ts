export interface EstadisticaClienteRow {
  clienteId: number;
  cliente: string;
  identificacion: string;
  cantidadPrestamos: number;
  totalPrestado: number;
  gananciaCobrada: number;
  antiguedad: string;
}

export interface EstadisticasClientesRepository {
  listar(): Promise<EstadisticaClienteRow[]>;
}

export const ESTADISTICAS_CLIENTES_REPOSITORY = Symbol('ESTADISTICAS_CLIENTES_REPOSITORY');
