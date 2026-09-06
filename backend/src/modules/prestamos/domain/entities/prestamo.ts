import { EstadoPrestamo } from '../enums/estado-prestamo.enum';

export interface DatosPrestamo {
  clienteId: number;
  periodicidadPagoId: number;
  formaPagoId: number;
  formaDesembolsoId?: number | null;
  fechaAlta: Date;
  capital: number;
  interes: number;
  cantidadPagos: number;
  planPersonalizado: boolean;
  observaciones?: string | null;
}

const normalizeObservaciones = (value?: string | null): string | null => value?.trim().toUpperCase() || null;

export class Prestamo {
  constructor(
    public id: number | null,
    public clienteId: number,
    public periodicidadPagoId: number,
    public formaPagoId: number,
    public formaDesembolsoId: number | null,
    public fechaAlta: Date,
    public capital: number,
    public interes: number,
    public montoTotal: number,
    public montoDesembolsado: number,
    public cantidadPagos: number,
    public planPersonalizado: boolean,
    public estado: EstadoPrestamo,
    public observaciones: string | null,
    public fechaCreacion: Date,
    public fechaActualizacion: Date,
  ) {}

  static crear(datos: DatosPrestamo): Prestamo {
    const now = new Date();
    return new Prestamo(null, datos.clienteId, datos.periodicidadPagoId, datos.formaPagoId, datos.formaDesembolsoId ?? null, datos.fechaAlta,
      datos.capital, datos.interes, datos.capital + datos.interes, datos.capital, datos.cantidadPagos,
      datos.planPersonalizado, EstadoPrestamo.ACTIVO, normalizeObservaciones(datos.observaciones), now, now);
  }

  actualizarDatos(datos: DatosPrestamo): void {
    this.clienteId = datos.clienteId;
    this.periodicidadPagoId = datos.periodicidadPagoId;
    this.formaPagoId = datos.formaPagoId;
    this.formaDesembolsoId = datos.formaDesembolsoId ?? null;
    this.fechaAlta = datos.fechaAlta;
    this.capital = datos.capital;
    this.interes = datos.interes;
    this.montoTotal = datos.capital + datos.interes;
    this.cantidadPagos = datos.cantidadPagos;
    this.planPersonalizado = datos.planPersonalizado;
    this.observaciones = normalizeObservaciones(datos.observaciones);
  }

  marcarCancelado(): void { if (this.estado !== EstadoPrestamo.ACTIVO) throw new Error('Transición de estado inválida.'); this.estado = EstadoPrestamo.CANCELADO; }
  marcarRefinanciado(): void { if (this.estado !== EstadoPrestamo.ACTIVO) throw new Error('Transición de estado inválida.'); this.estado = EstadoPrestamo.REFINANCIADO; }
  marcarIncobrable(): void { if (this.estado !== EstadoPrestamo.ACTIVO) throw new Error('Transición de estado inválida.'); this.estado = EstadoPrestamo.INCOBRABLE; }
  reactivar(): void { if (this.estado !== EstadoPrestamo.INCOBRABLE) throw new Error('Transición de estado inválida.'); this.estado = EstadoPrestamo.ACTIVO; }
}
