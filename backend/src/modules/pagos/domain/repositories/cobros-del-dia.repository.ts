export interface CobrosDelDiaFilters { fecha?: string; fechaDesde?: string; fechaHasta?: string; }

export interface CobroProgramado {
  planPagoId: number;
  numeroPago: number;
  fecha: string;
  montoProgramado: number;
  saldoPendiente: number;
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

export interface PagoRecibido {
  pagoId: number;
  fecha: string;
  monto: number;
  planPagoId: number | null;
  numeroPago: number | null;
  fechaVencimiento: string | null;
  prestamoId: number;
  estadoPrestamo: string;
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

export interface CobrosDelDiaResult {
  porCobrar: CobroProgramado[];
  pagaron: PagoRecibido[];
}

export interface CobrosDelDiaRepository {
  consultar(query: CobrosDelDiaFilters): Promise<CobrosDelDiaResult>;
}

export const COBROS_DEL_DIA_REPOSITORY = Symbol('COBROS_DEL_DIA_REPOSITORY');
