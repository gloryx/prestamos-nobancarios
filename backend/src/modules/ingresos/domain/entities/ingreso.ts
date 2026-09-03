export class Ingreso {
  constructor(public id: number | null, public fuenteIngresoId: number, public fecha: string, public monto: number, public descripcion: string | null, public usuarioId: number, public fechaCreacion: Date | null = null, public fechaActualizacion: Date | null = null, public fuenteIngreso?: { id: number; nombre: string; activo: boolean }, public usuario?: { id: number; nombreCompleto: string }) {}
  static crear(fuenteIngresoId: number, fecha: string, monto: number, descripcion: string | null, usuarioId: number) { return new Ingreso(null, fuenteIngresoId, fecha, monto, descripcion?.trim() || null, usuarioId); }
}
