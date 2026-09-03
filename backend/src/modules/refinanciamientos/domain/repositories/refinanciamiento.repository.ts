import { Refinanciamiento } from '../entities/refinanciamiento';

export interface FiltrosRefinanciamientos { pagina: number; limite: number; buscar?: string; clienteId?: number; fechaDesde?: string; fechaHasta?: string; }
export interface RefinanciamientoRelacion { id: number; estado: string; clienteId: number; capital: number; interes: number; montoTotal: number; montoDesembolsado: number; }
export interface RefinanciamientoPago { id: number; monto: number; capitalAplicado: number; interesAplicado: number; fecha: Date; }
export interface RefinanciamientoPlan { id: number; numeroPago: number; fechaVencimiento: Date; montoProgramado: number; }
export interface RefinanciamientoConRelaciones extends Refinanciamiento { prestamoOrigen?: RefinanciamientoRelacion; prestamoNuevo?: RefinanciamientoRelacion; pagosOrigen?: RefinanciamientoPago[]; pagosNuevo?: RefinanciamientoPago[]; planNuevo?: RefinanciamientoPlan[]; }
export interface RefinanciamientosPaginados { datos: RefinanciamientoConRelaciones[]; pagina: number; limite: number; total: number; totalPaginas: number; }
export interface RefinanciamientoRepository {
  guardar(value: Refinanciamiento): Promise<RefinanciamientoConRelaciones>;
  buscarPorId(id: number): Promise<RefinanciamientoConRelaciones | null>;
  buscarPorPrestamoOrigenId(id: number): Promise<RefinanciamientoConRelaciones | null>;
  buscarPorPrestamoNuevoId(id: number): Promise<RefinanciamientoConRelaciones | null>;
  existePorPrestamoOrigenId(id: number): Promise<boolean>;
  existePorPrestamoNuevoId(id: number): Promise<boolean>;
  listar(filters: FiltrosRefinanciamientos): Promise<RefinanciamientosPaginados>;
}
export const REFINANCIAMIENTO_REPOSITORY = Symbol('REFINANCIAMIENTO_REPOSITORY');
