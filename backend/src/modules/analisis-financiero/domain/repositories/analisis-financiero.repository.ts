export const ANALISIS_FINANCIERO_REPOSITORY = Symbol('ANALISIS_FINANCIERO_REPOSITORY');

export interface AnalisisFinancieroPeriodoRow {
  periodo: string;
  monto: string | number;
  interesAplicado?: string | number;
}

export interface AnalisisFinancieroRepository {
  pagos(desde: number, hasta: number): Promise<AnalisisFinancieroPeriodoRow[]>;
  prestamos(desde: number, hasta: number): Promise<AnalisisFinancieroPeriodoRow[]>;
  proyeccion(): Promise<ProyeccionFinancieraData>;
}

export interface ProyeccionPrestamoRow { id: number; clienteId: number; cliente: string; estado: string; interes: string | number }
export interface ProyeccionPlanRow { id: number; prestamoId: number; numeroPago: number; fechaVencimiento: string; montoProgramado: string | number }
export interface ProyeccionPagoRow { planPagoId: number; prestamoId: number; monto: string | number; interesAplicado: string | number }
export interface ProyeccionFinancieraData { prestamos: ProyeccionPrestamoRow[]; planes: ProyeccionPlanRow[]; pagos: ProyeccionPagoRow[] }
