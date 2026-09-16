import { Pago } from '../entities/pago';
import { MotivoAnulacionPago } from '../enums/motivo-anulacion-pago.enum';
export interface FiltrosPagos {
  pagina: number;
  limite: number;
  formaPagoId?: number;
  cobradorId?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  buscar?: string;
  prestamoId?: number;
  estado?: string;
}
export interface PrestamoPagoRelacion { id: number; estado: string; capital: number; interes: number; montoTotal: number; }
export interface PagoRelacion { id: number; nombre?: string; identificacion?: string; nombreCompleto?: string; telefono?: string | null; telefonoPrincipal?: string | null; correo?: string | null; }
export interface FormaPagoPagoRelacion { id: number; nombre: string; }
export interface CobradorPagoRelacion { id: number; identificacion: string; nombreCompleto: string; telefono: string | null; correo: string | null; }
export interface PagoAnulacionRelacion { fecha: Date; motivo: MotivoAnulacionPago; observacion: string | null; usuario?: { id: number; nombreCompleto: string }; }
export interface PagoConRelaciones extends Pago { formaPago: FormaPagoPagoRelacion; prestamo: PrestamoPagoRelacion; cliente: PagoRelacion; cobrador: CobradorPagoRelacion; planPago?: { id: number; numeroPago: number; fechaVencimiento: Date | string } | null; numeroPago?: number | null; numeroCuota?: number | null; fechaAnulacion?: Date | null; usuarioAnulacionId?: number | null; motivoAnulacion?: MotivoAnulacionPago | null; observacionAnulacion?: string | null; anulacion?: PagoAnulacionRelacion | null; puedeAnular?: boolean; }
export interface PagosPaginados { datos: PagoConRelaciones[]; pagina: number; limite: number; total: number; totalPaginas: number; totales: { cantidadPagos: number; totalRecibido: number; capitalAplicado: number; interesAplicado: number }; }
export interface TotalesPago { total: number; capital: number; interes: number; }
export interface PagosExportacion { datos: PagoConRelaciones[]; totales: { cantidadPagos: number; totalRecibido: number; capitalAplicado: number; interesAplicado: number }; }
export interface PagoRepository {
  guardar(pago: Pago): Promise<Pago>;
  buscarPorId(id: number): Promise<PagoConRelaciones | null>;
  listarPorPrestamo(prestamoId: number): Promise<PagoConRelaciones[]>;
  obtenerTotalesPorPrestamo(prestamoId: number): Promise<TotalesPago>;
  listar(filtros: FiltrosPagos): Promise<PagosPaginados>;
  listarParaExportacion(filtros: FiltrosPagos): Promise<PagosExportacion>;
  existePagoParaPrestamo(prestamoId: number): Promise<boolean>;
}
export const PAGO_REPOSITORY = Symbol('PAGO_REPOSITORY');
