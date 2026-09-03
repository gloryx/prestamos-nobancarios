export class FuenteIngreso {
  constructor(public id: number | null, public nombre: string, public activo: boolean, public fechaCreacion: Date | null = null) {}
  static crear(nombre: string) { return new FuenteIngreso(null, nombre.trim().toUpperCase(), true); }
  actualizarNombre(nombre: string) { this.nombre = nombre.trim().toUpperCase(); }
  activar() { this.activo = true; }
  desactivar() { this.activo = false; }
}
