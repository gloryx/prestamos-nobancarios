export interface DatosPlanPago {
  prestamoId: number;
  numeroPago: number;
  fechaVencimiento: Date;
  montoProgramado: number;
}

export class PlanPago {
  constructor(
    public id: number | null,
    public prestamoId: number,
    public numeroPago: number,
    public fechaVencimiento: Date,
    public montoProgramado: number,
    public fechaCreacion: Date,
  ) {}

  static crear(datos: DatosPlanPago, fechaCreacion = new Date()): PlanPago {
    return new PlanPago(null, datos.prestamoId, datos.numeroPago, new Date(datos.fechaVencimiento.getTime()), datos.montoProgramado, fechaCreacion);
  }
}
