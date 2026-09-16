export const DESEMPENO_COBRADORES_REPOSITORY = Symbol('DESEMPENO_COBRADORES_REPOSITORY');

export type DesempenoCobradorRow = {
  cobradorId: number | null;
  cobradorNombre: string | null;
  cantidadPagos: number;
  montoRecibido: number;
  capitalAplicado: number;
  interesAplicado: number;
  cantidadClientes: number;
  cantidadPrestamos: number;
};

export type DesempenoCobradoresTotalesRow = {
  cantidadPagos: number;
  totalRecibido: number;
  capitalAplicado: number;
  interesAplicado: number;
  cantidadCobradores: number;
};

export interface DesempenoCobradoresRepository {
  agrupar(query: { fechaDesde: string; fechaHasta: string; cobradorId?: number; formaPagoId?: number }): Promise<DesempenoCobradorRow[]>;
  totales(query: { fechaDesde: string; fechaHasta: string; cobradorId?: number; formaPagoId?: number }): Promise<DesempenoCobradoresTotalesRow>;
}
