import { EstadoPrestamo } from '../../../prestamos/domain/enums/estado-prestamo.enum';

export interface AnalisisPrestamo {
  id: number;
  estado: EstadoPrestamo;
  fechaAlta: Date;
  capital: number;
  interes: number;
  montoTotal: number;
  montoDesembolsado: number;
  cantidadPagos: number;
  periodicidad: string;
}

export interface AnalisisPago {
  id: number;
  prestamoId: number;
  monto: number;
  capitalAplicado: number;
  interesAplicado: number;
  fecha: string;
}

export interface AnalisisPagoTotales {
  prestamoId: number;
  monto: number;
  capital: number;
  interes: number;
}

export interface AnalisisRefinanciamiento {
  id: number;
  prestamoOrigenId: number;
  prestamoNuevoId: number;
  fecha: string;
  capitalPendiente: number;
}

export interface AnalisisFinancieroRepository {
  listarPrestamos(clienteId: number): Promise<AnalisisPrestamo[]>;
  obtenerTotalesPagos(prestamoIds: number[]): Promise<AnalisisPagoTotales[]>;
  listarUltimosPagos(prestamoIds: number[]): Promise<AnalisisPago[]>;
  listarPagosOrdenados(prestamoIds: number[]): Promise<AnalisisPago[]>;
  listarRefinanciamientos(prestamoIds: number[]): Promise<AnalisisRefinanciamiento[]>;
  listarObligacionesVencidas(prestamoIds: number[], hoy: string): Promise<number[]>;
}

export const ANALISIS_FINANCIERO_REPOSITORY = Symbol('ANALISIS_FINANCIERO_REPOSITORY');
