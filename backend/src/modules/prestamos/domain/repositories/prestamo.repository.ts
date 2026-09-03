import { Prestamo } from '../entities/prestamo';
import { EstadoPrestamo } from '../enums/estado-prestamo.enum';

export interface FiltrosPrestamos { pagina: number; limite: number; buscar?: string; estado?: EstadoPrestamo; clienteId?: number; }
export interface PrestamoRelacion { id: number; nombre: string; identificacion?: string; nombreCompleto?: string; }
export interface PrestamoConRelaciones extends Prestamo { cliente: PrestamoRelacion; periodicidadPago: PrestamoRelacion; formaPago: PrestamoRelacion; }
export interface PrestamosPaginados { datos: PrestamoConRelaciones[]; pagina: number; limite: number; total: number; totalPaginas: number; }

export interface PrestamoRepository {
  guardar(prestamo: Prestamo): Promise<PrestamoConRelaciones>;
  buscarPorId(id: number): Promise<PrestamoConRelaciones | null>;
  actualizar(prestamo: Prestamo): Promise<PrestamoConRelaciones>;
  listar(filtros: FiltrosPrestamos): Promise<PrestamosPaginados>;
}
export const PRESTAMO_REPOSITORY = Symbol('PRESTAMO_REPOSITORY');
