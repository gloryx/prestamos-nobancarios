import { Prestamo } from '../entities/prestamo';
import { EstadoPrestamo } from '../enums/estado-prestamo.enum';

export type OrdenarPrestamosPor = 'id' | 'cliente' | 'direccion' | 'fechaAlta' | 'capital' | 'estado';
export type DireccionOrden = 'ASC' | 'DESC';
export interface FiltrosPrestamos { pagina: number; limite: number; buscar?: string; direccion?: string; estados?: EstadoPrestamo[]; fechaInicio?: string; fechaFin?: string; estado?: EstadoPrestamo; clienteId?: number; ordenarPor?: OrdenarPrestamosPor; direccionOrden?: DireccionOrden; }
export interface PrestamoRelacion { id: number; nombre: string; identificacion?: string; nombreCompleto?: string; direccion?: string | null; }
export interface PrestamoConRelaciones extends Prestamo { cliente: PrestamoRelacion; periodicidadPago: PrestamoRelacion; formaPago: PrestamoRelacion; formaDesembolso: PrestamoRelacion | null; }
export interface PrestamosPaginados { datos: PrestamoConRelaciones[]; pagina: number; limite: number; total: number; totalPaginas: number; }
export interface PrestamosResumen { total: number; prestado: number; ganancia: number; recuperado: number; pendiente: number; }
export interface PrestamoParaExportacion extends PrestamoConRelaciones { recuperado: number; }

export interface PrestamoRepository {
  guardar(prestamo: Prestamo): Promise<PrestamoConRelaciones>;
  buscarPorId(id: number): Promise<PrestamoConRelaciones | null>;
  actualizar(prestamo: Prestamo): Promise<PrestamoConRelaciones>;
  listar(filtros: FiltrosPrestamos): Promise<PrestamosPaginados>;
  resumen(filtros: FiltrosPrestamos): Promise<PrestamosResumen>;
  listarParaExportacion(filtros: FiltrosPrestamos): Promise<PrestamoParaExportacion[]>;
}
export const PRESTAMO_REPOSITORY = Symbol('PRESTAMO_REPOSITORY');
