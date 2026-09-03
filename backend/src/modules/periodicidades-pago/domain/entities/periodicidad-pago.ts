export class PeriodicidadPago {
  constructor(
    public id: number | null,
    public nombre: string,
    public activo: boolean,
  ) {}

  static crear(nombre: string): PeriodicidadPago {
    return new PeriodicidadPago(null, nombre.trim().toUpperCase(), true);
  }

  actualizarNombre(nombre: string): void {
    this.nombre = nombre.trim().toUpperCase();
  }

  activar(): void {
    this.activo = true;
  }

  desactivar(): void {
    this.activo = false;
  }
}
