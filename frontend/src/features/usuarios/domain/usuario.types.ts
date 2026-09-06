export type UsuarioRol = 'ADMINISTRADOR' | 'VENDEDOR'

export interface Usuario {
  id: number
  identificacion: string
  nombreCompleto: string
  telefono: string | null
  correo: string | null
  rol: UsuarioRol
  activo: boolean
  fechaCreacion?: string
  fechaActualizacion?: string
}

export interface UsuarioPage { datos: Usuario[]; pagina: number; limite: number; total: number; totalPaginas: number }
export interface UsuarioSelector { id: number; nombreCompleto: string; activo?: boolean }
export interface UsuarioFilters { pagina: number; limite: number; buscar?: string; activo?: boolean; rol?: UsuarioRol }
export interface CrearUsuarioInput { identificacion: string; nombreCompleto: string; telefono: string | null; correo: string | null; rol: UsuarioRol; password: string }
export interface ActualizarUsuarioInput { identificacion?: string; nombreCompleto?: string; telefono?: string | null; correo?: string | null; rol?: UsuarioRol }

export interface UsuarioRepository {
  list(filters: UsuarioFilters): Promise<UsuarioPage>
  listSelector(): Promise<UsuarioSelector[]>
  create(input: CrearUsuarioInput): Promise<Usuario>
  update(id: number, input: ActualizarUsuarioInput): Promise<Usuario>
  changeStatus(id: number, activo: boolean): Promise<Usuario>
}
