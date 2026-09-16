export interface CobrosDelDiaFilters { fecha?: string; fechaDesde?: string; fechaHasta?: string; }

export interface CobroDelDia {
  planPagoId: number;
  numeroPago: number;
  fecha: string;
  montoProgramado: number;
  montoPagado: number;
  estado: 'PAGADO' | 'PENDIENTE';
  prestamoId: number;
  capital: number;
  saldoActual: number;
  estadoPrestamo: string;
  periodicidad: string;
  clienteId: number;
  nombreCompleto: string;
  identificacion: string;
  telefonoPrincipal: string;
  direccion: string | null;
  formaPagoId: number;
  formaPagoNombre: string;
  cobradorId: number | null;
  cobradorNombre: string | null;
}

export interface CobrosDelDiaRepository {
  consultar(query: CobrosDelDiaFilters): Promise<CobroDelDia[]>;
}

export const COBROS_DEL_DIA_REPOSITORY = Symbol('COBROS_DEL_DIA_REPOSITORY');
