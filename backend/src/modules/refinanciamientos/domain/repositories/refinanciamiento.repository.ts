import { Refinanciamiento } from '../entities/refinanciamiento';
import { Cliente } from '../../../clientes/domain/entities/cliente';

export interface FiltrosRefinanciamientos { pagina: number; limite: number; buscar?: string; clienteId?: number; fechaDesde?: string; fechaHasta?: string; }
export interface ClienteRefinanciamientoResumen { id: number; identificacion: string; nombreCompleto: string; }
export interface RefinanciamientoRelacion { id: number; estado: string; clienteId: number; formaPagoId: number; formaDesembolsoId: number | null; capital: number; interes: number; montoTotal: number; montoDesembolsado: number; }
export interface RefinanciamientoPago { id: number; monto: number; capitalAplicado: number; interesAplicado: number; fecha: Date; }
export interface RefinanciamientoPlan { id: number; numeroPago: number; fechaVencimiento: Date; montoProgramado: number; }
export interface RefinanciamientoConRelaciones extends Refinanciamiento { cliente?: ClienteRefinanciamientoResumen; prestamoOrigen?: RefinanciamientoRelacion; prestamoNuevo?: RefinanciamientoRelacion; pagosOrigen?: RefinanciamientoPago[]; pagosNuevo?: RefinanciamientoPago[]; planNuevo?: RefinanciamientoPlan[]; }
export interface RefinanciamientosPaginados { datos: RefinanciamientoConRelaciones[]; pagina: number; limite: number; total: number; totalPaginas: number; }
export interface PrestamoCadena { id: number; clienteId: number; estado: string; fechaAlta: Date; capital: number; interes: number; montoTotal: number; montoDesembolsado: number; }
export interface DatosCadenasCliente { cliente: Cliente; prestamos: PrestamoCadena[]; refinanciamientos: RefinanciamientoConRelaciones[]; }
export interface RefinanciamientoRepository {
  guardar(value: Refinanciamiento): Promise<RefinanciamientoConRelaciones>;
  buscarPorId(id: number): Promise<RefinanciamientoConRelaciones | null>;
  buscarPorPrestamoOrigenId(id: number): Promise<RefinanciamientoConRelaciones | null>;
  buscarPorPrestamoNuevoId(id: number): Promise<RefinanciamientoConRelaciones | null>;
  existePorPrestamoOrigenId(id: number): Promise<boolean>;
  existePorPrestamoNuevoId(id: number): Promise<boolean>;
  listar(filters: FiltrosRefinanciamientos): Promise<RefinanciamientosPaginados>;
  buscarDatosCadenasPorClienteId(clienteId: number): Promise<DatosCadenasCliente | null>;
}
export const REFINANCIAMIENTO_REPOSITORY = Symbol('REFINANCIAMIENTO_REPOSITORY');
