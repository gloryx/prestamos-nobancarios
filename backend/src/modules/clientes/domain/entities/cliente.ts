import { Nacionalidad } from '../enums/nacionalidad.enum';
import { Genero } from '../enums/genero.enum';

export interface DatosCliente {
  identificacion: string;
  primerNombre: string;
  segundoNombre?: string | null;
  primerApellido: string;
  segundoApellido?: string | null;
  genero?: Genero | null;
  fechaNacimiento?: Date | null;
  direccion?: string | null;
  correo?: string | null;
  telefono1: string;
  telefono2?: string | null;
  nacionalidad?: Nacionalidad | null;
  observaciones?: string | null;
  urlIdentificacion?: string | null;
}

const upper = (value?: string | null): string | null => {
  if (value == null || value.trim() === '') return null;
  return value.trim().toUpperCase();
};

export class Cliente {
  constructor(
    public id: number | null,
    public identificacion: string,
    public primerNombre: string,
    public segundoNombre: string | null,
    public primerApellido: string,
    public segundoApellido: string | null,
    public genero: Genero | null,
    public fechaNacimiento: Date | null,
    public direccion: string | null,
    public correo: string | null,
    public telefono1: string,
    public telefono2: string | null,
    public nacionalidad: Nacionalidad | null,
    public observaciones: string | null,
    public fechaIngreso: Date,
    public urlIdentificacion: string | null,
    public activo: boolean,
  ) {}

  static crear(datos: DatosCliente): Cliente {
    return new Cliente(
      null, upper(datos.identificacion)!, upper(datos.primerNombre)!, upper(datos.segundoNombre),
      upper(datos.primerApellido)!, upper(datos.segundoApellido), datos.genero ?? null, datos.fechaNacimiento ?? null,
      upper(datos.direccion), datos.correo?.trim() ? datos.correo.trim().toLowerCase() : null,
      upper(datos.telefono1)!, upper(datos.telefono2), datos.nacionalidad ?? null, upper(datos.observaciones),
      new Date(), datos.urlIdentificacion?.trim() || null, true,
    );
  }

  actualizarDatos(datos: DatosCliente): void {
    this.identificacion = upper(datos.identificacion)!;
    this.primerNombre = upper(datos.primerNombre)!;
    this.segundoNombre = upper(datos.segundoNombre);
    this.primerApellido = upper(datos.primerApellido)!;
    this.segundoApellido = upper(datos.segundoApellido);
    this.genero = datos.genero ?? null;
    this.fechaNacimiento = datos.fechaNacimiento ?? null;
    this.direccion = upper(datos.direccion);
    this.correo = datos.correo?.trim() ? datos.correo.trim().toLowerCase() : null;
    this.telefono1 = upper(datos.telefono1)!;
    this.telefono2 = upper(datos.telefono2);
    this.nacionalidad = datos.nacionalidad ?? null;
    this.observaciones = upper(datos.observaciones);
    this.urlIdentificacion = datos.urlIdentificacion?.trim() || null;
  }

  activar(): void { this.activo = true; }
  desactivar(): void { this.activo = false; }
}
