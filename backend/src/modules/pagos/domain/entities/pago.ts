export interface DatosPago {
  prestamoId: number;
  formaPagoId: number;
  monto: number;
  capitalAplicado: number;
  interesAplicado: number;
  cobradorId: number;
  fecha: Date;
  observaciones?: string | null;
  planPagoId?: number | null;
}

export class Pago {
  constructor(
    public id: number | null,
    public prestamoId: number,
    public formaPagoId: number,
    public monto: number,
    public capitalAplicado: number,
    public interesAplicado: number,
    public cobradorId: number,
    public fecha: Date,
    public observaciones: string | null,
    public fechaCreacion: Date,
    public planPagoId?: number | null,
  ) {}

  static crear(datos: DatosPago): Pago {
    return new Pago(null, datos.prestamoId, datos.formaPagoId, datos.monto, datos.capitalAplicado, datos.interesAplicado, datos.cobradorId, datos.fecha, datos.observaciones?.trim() || null, new Date(), datos.planPagoId ?? null);
  }
}
