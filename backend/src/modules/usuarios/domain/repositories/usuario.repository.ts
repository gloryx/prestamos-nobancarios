import { Usuario } from '../entities/usuario';
import { RolUsuario } from '../enums/rol-usuario.enum';
import { EntityManager } from 'typeorm';

export interface FiltrosUsuarios { pagina: number; limite: number; buscar?: string; activo?: boolean; rol?: RolUsuario; }
export interface UsuariosPaginados { datos: Usuario[]; pagina: number; limite: number; total: number; totalPaginas: number; }
export interface UsuarioSelector { id: number; nombreCompleto: string; }
export interface UsuarioRepository {
  guardar(usuario: Usuario): Promise<Usuario>;
  buscarPorId(id: number): Promise<Usuario | null>;
  buscarPorIdEnTransaccion(manager: EntityManager, id: number): Promise<Usuario | null>;
  buscarPorIdentificacion(identificacion: string): Promise<Usuario | null>;
  actualizar(usuario: Usuario): Promise<Usuario>;
  listar(filtros: FiltrosUsuarios): Promise<UsuariosPaginados>;
  listarSelector(): Promise<UsuarioSelector[]>;
}
export const USUARIO_REPOSITORY = Symbol('USUARIO_REPOSITORY');
