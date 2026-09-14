import { Prestamo } from '../entities/prestamo';
import { EstadoPrestamo } from '../enums/estado-prestamo.enum';
import { FiltrosIncobrablesDto } from '../../application/dto/filtros-incobrables.dto';
import { EntityManager } from 'typeorm';

export type OrdenarPrestamosPor = 'id' | 'cliente' | 'direccion' | 'fechaAlta' | 'capital' | 'saldoPendiente' | 'estado' | 'indicadorCobranza';
export type DireccionOrden = 'ASC' | 'DESC';
export interface FiltrosPrestamos { pagina: number; limite: number; buscar?: string; direccion?: string; estados?: EstadoPrestamo[]; fechaInicio?: string; fechaFin?: string; estado?: EstadoPrestamo; clienteId?: number; ordenarPor?: OrdenarPrestamosPor; direccionOrden?: DireccionOrden; candidateIds?: number[]; }
export interface PrestamoRelacion { id: number; nombre: string; identificacion?: string; nombreCompleto?: string; direccion?: string | null; telefono?: string | null; }
export interface PrestamoConRelaciones extends Prestamo { cliente: PrestamoRelacion; periodicidadPago: PrestamoRelacion; formaPago: PrestamoRelacion; formaDesembolso: PrestamoRelacion | null; puedeAnular?: boolean; }
export interface PrestamoListado extends PrestamoConRelaciones { capitalPendiente: number; saldoPendiente: number; }
export interface PrestamosPaginados { datos: PrestamoListado[]; pagina: number; limite: number; total: number; totalPaginas: number; }
export interface IncobrableListado extends PrestamoListado { fechaVencimiento?: string; saldoCuota?: number; fechaIncobrable?: string; observacionIncobrable?: string | null; diasEnEstado?: number; ultimaFechaPago?: string | null; puedePasarAIncobrable: boolean; puedeReactivar: boolean; }
export interface IncobrablesPaginados { datos: IncobrableListado[]; pagina: number; limite: number; total: number; totalPaginas: number; }
export interface AnulacionListado extends PrestamoListado { fechaAnulacion: string; observacionAnulacion: string | null; movimientoDesembolsoId: number | null; movimientoReversoId: number | null; fechaReverso: string | null; montoReversado: number | null; usuarioAnulacion: { id: number; nombreCompleto: string } | null; }
export interface AnulacionesPaginadas { datos: AnulacionListado[]; pagina: number; limite: number; total: number; totalPaginas: number; }
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
  listarCandidatosIncobrables(filtros: FiltrosIncobrablesDto): Promise<IncobrablesPaginados>;
  listarIncobrables(filtros: FiltrosIncobrablesDto): Promise<IncobrablesPaginados>;
  listarCandidatosAnulacion(filtros: FiltrosPrestamos): Promise<PrestamosPaginados>;
  listarAnulados(filtros: FiltrosPrestamos): Promise<AnulacionesPaginadas>;
  esElegibleParaIncobrable(id: number, fechaReferencia: string, manager?: EntityManager): Promise<boolean>;
}
export const PRESTAMO_REPOSITORY = Symbol('PRESTAMO_REPOSITORY');
