export type Genero = 'FEMENINO' | 'MASCULINO'
export type Nacionalidad = 'COSTARRICENSE' | 'NICARAGUENSE' | 'PANAMEÑO' | 'ARABE'

export interface Cliente {
  id: number
  identificacion: string
  primerNombre: string
  segundoNombre: string | null
  primerApellido: string
  segundoApellido: string | null
  genero: Genero | null
  fechaNacimiento: string | null
  direccion: string | null
  correo: string | null
  telefono1: string
  telefono2: string | null
  nacionalidad: Nacionalidad | null
  observaciones: string | null
  urlIdentificacion: string | null
  activo: boolean
  fechaIngreso: string
}

export interface ClientePage { datos: Cliente[]; pagina: number; limite: number; total: number; totalPaginas: number }
export interface ClienteFilters { pagina: number; limite: number; buscar?: string; direccion?: string; activo?: boolean }
export interface ClienteInput {
  identificacion: string; primerNombre: string; segundoNombre: string | null; primerApellido: string; segundoApellido: string | null; identificacionFile?: File | null
  genero: Genero | null; fechaNacimiento: string | null; direccion: string | null; correo: string | null; telefono1: string
  telefono2: string | null; nacionalidad: Nacionalidad | null; observaciones: string | null
}
export type CrearClienteInput = ClienteInput
export type ActualizarClienteInput = ClienteInput

export interface ClienteRepository {
  list(filters: ClienteFilters): Promise<ClientePage>
  getById(id: number): Promise<Cliente>
  create(input: CrearClienteInput): Promise<Cliente>
  update(id: number, input: ActualizarClienteInput): Promise<Cliente>
  changeStatus(id: number, activo: boolean): Promise<Cliente>
  getIdentificationImage(id: number): Promise<Blob>
  downloadClientSheet(id: number): Promise<Blob>
}
