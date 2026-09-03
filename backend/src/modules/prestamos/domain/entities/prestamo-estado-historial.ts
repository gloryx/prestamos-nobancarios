import { EstadoPrestamo } from '../enums/estado-prestamo.enum';

export class PrestamoEstadoHistorial {
  constructor(
    public id: number | null,
    public prestamoId: number,
    public estadoAnterior: EstadoPrestamo | null,
    public estadoNuevo: EstadoPrestamo,
    public fecha: Date,
    public usuarioId: number,
    public observacion: string | null,
    public fechaCreacion: Date,
    public usuario?: { id: number; nombreCompleto: string },
  ) {}
}
