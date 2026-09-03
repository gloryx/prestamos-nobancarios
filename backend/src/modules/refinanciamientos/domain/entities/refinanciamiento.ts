export interface DatosRefinanciamiento {
  prestamoOrigenId: number;
  prestamoNuevoId: number;
  fecha: Date;
  capitalPendiente: number;
  interesPendiente: number;
  montoRefinanciado: number;
  interesNuevo: number;
  observaciones?: string | null;
}

export class Refinanciamiento {
  constructor(
    public id: number | null,
    public prestamoOrigenId: number,
    public prestamoNuevoId: number,
    public fecha: Date,
    public capitalPendiente: number,
    public interesPendiente: number,
    public montoRefinanciado: number,
    public interesNuevo: number,
    public observaciones: string | null,
    public fechaCreacion: Date,
  ) {}

  static crear(data: DatosRefinanciamiento): Refinanciamiento {
    return new Refinanciamiento(null, data.prestamoOrigenId, data.prestamoNuevoId, data.fecha,
      data.capitalPendiente, data.interesPendiente, data.montoRefinanciado, data.interesNuevo,
      data.observaciones?.trim() || null, new Date());
  }
}
