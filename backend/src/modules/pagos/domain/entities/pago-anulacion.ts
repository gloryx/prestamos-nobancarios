import { MotivoAnulacionPago } from '../enums/motivo-anulacion-pago.enum';

export class PagoAnulacion {
  constructor(
    public id: number | null,
    public pagoId: number,
    public fecha: Date,
    public usuarioId: number,
    public motivo: MotivoAnulacionPago,
    public observacion: string | null,
    public fechaCreacion: Date,
    public usuario?: { id: number; nombreCompleto: string },
  ) {}
}
