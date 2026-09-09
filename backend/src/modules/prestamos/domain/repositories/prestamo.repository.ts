import { Prestamo } from '../entities/prestamo';
import { EstadoPrestamo } from '../enums/estado-prestamo.enum';

export type OrdenarPrestamosPor = 'id' | 'cliente' | 'direccion' | 'fechaAlta' | 'capital' | 'saldoPendiente' | 'estado' | 'indicadorCobranza';
export type DireccionOrden = 'ASC' | 'DESC';
export interface FiltrosPrestamos { pagina: number; limite: number; buscar?: string; direccion?: string; estados?: EstadoPrestamo[]; fechaInicio?: string; fechaFin?: string; estado?: EstadoPrestamo; clienteId?: number; ordenarPor?: OrdenarPrestamosPor; direccionOrden?: DireccionOrden; candidateIds?: number[]; }
export interface PrestamoRelacion { id: number; nombre: string; identificacion?: string; nombreCompleto?: string; direccion?: string | null; }
export interface PrestamoConRelaciones extends Prestamo { cliente: PrestamoRelacion; periodicidadPago: PrestamoRelacion; formaPago: PrestamoRelacion; formaDesembolso: PrestamoRelacion | null; }
export interface PrestamoListado extends PrestamoConRelaciones { capitalPendiente: number; saldoPendiente: number; }
export interface PrestamosPaginados { datos: PrestamoListado[]; pagina: number; limite: number; total: number; totalPaginas: number; }
export interface PrestamosResumen { total: number; prestado: number; ganancia: number; recuperado: number; pendiente: number; }
export interface PrestamoParaExportacion extends PrestamoConRelaciones { recuperado: number; }

export interface PrestamoRepository {
  guardar(prestamo: Prestamo): Promise<PrestamoConRelaciones>;
  buscarPorId(id: number): Promise<PrestamoConRelaciones | null>;
  actualizar(prestamo: Prestamo): Promise<PrestamoConRelaciones>;
  listar(filtros: FiltrosPrestamos): Promise<PrestamosPaginados>;
  listarParaIndicador(filtros: FiltrosPrestamos): Promise<PrestamoConRelaciones[]>;
  resumen(filtros: FiltrosPrestamos): Promise<PrestamosResumen>;
  listarParaExportacion(filtros: FiltrosPrestamos): Promise<PrestamoParaExportacion[]>;
}
export const PRESTAMO_REPOSITORY = Symbol('PRESTAMO_REPOSITORY');
