import { Ingreso } from '../entities/ingreso';
export type FiltrosIngresos = { page: number; limit: number; fuenteIngresoId?: number; fechaDesde?: string; fechaHasta?: string; search?: string };
export type IngresosPaginados = { datos: Ingreso[]; pagina: number; limite: number; total: number; totalPaginas: number };
export const INGRESO_REPOSITORY = Symbol('INGRESO_REPOSITORY');
export interface IngresoRepository { guardar(value: Ingreso): Promise<Ingreso>; buscarPorId(id: number): Promise<Ingreso | null>; listar(filters: FiltrosIngresos): Promise<IngresosPaginados>; }
