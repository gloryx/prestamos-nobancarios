import { RolUsuario } from '../enums/rol-usuario.enum';

export interface DatosUsuario {
  identificacion: string;
  nombreCompleto: string;
  telefono?: string | null;
  correo?: string | null;
  rol: RolUsuario;
  passwordHash: string;
}

export const normalizeText = (value?: string | null): string | null => value?.trim() ? value.trim().toUpperCase() : null;
export const normalizeIdentificacion = (value: string): string => normalizeText(value) as string;
export const normalizeCorreo = (value?: string | null): string | null => value?.trim() ? value.trim().toLowerCase() : null;

export class Usuario {
  constructor(
    public id: number | null,
    public identificacion: string,
    public nombreCompleto: string,
    public telefono: string | null,
    public correo: string | null,
    public rol: RolUsuario,
    public passwordHash: string,
    public fechaCreacion: Date,
    public fechaActualizacion: Date,
    public activo: boolean,
  ) {}

  static crear(datos: DatosUsuario): Usuario {
    const now = new Date();
    return new Usuario(null, normalizeIdentificacion(datos.identificacion), normalizeText(datos.nombreCompleto) as string, normalizeText(datos.telefono), normalizeCorreo(datos.correo), datos.rol, datos.passwordHash, now, now, true);
  }

  actualizarDatos(datos: Omit<DatosUsuario, 'passwordHash'>): void {
    this.identificacion = normalizeIdentificacion(datos.identificacion);
    this.nombreCompleto = normalizeText(datos.nombreCompleto) as string;
    this.telefono = normalizeText(datos.telefono);
    this.correo = normalizeCorreo(datos.correo);
    this.rol = datos.rol;
    this.fechaActualizacion = new Date();
  }

  activar(): void { this.activo = true; this.fechaActualizacion = new Date(); }
  desactivar(): void { this.activo = false; this.fechaActualizacion = new Date(); }
}
