import { Cliente } from '../entities/cliente';
import { EntityManager } from 'typeorm';

export interface FiltrosClientes {
  pagina: number;
  limite: number;
  buscar?: string;
  direccion?: string;
  activo?: boolean;
}

export interface ClientesPaginados {
  datos: Cliente[];
  pagina: number;
  limite: number;
  total: number;
  totalPaginas: number;
}

export interface ClienteRepository {
  guardar(cliente: Cliente): Promise<Cliente>;
  buscarPorId(id: number): Promise<Cliente | null>;
  buscarPorIdEnTransaccion(manager: EntityManager, id: number): Promise<Cliente | null>;
  buscarPorIdentificacion(identificacion: string): Promise<Cliente | null>;
  actualizar(cliente: Cliente): Promise<Cliente>;
  listar(filtros: FiltrosClientes): Promise<ClientesPaginados>;
}

export const CLIENTE_REPOSITORY = Symbol('CLIENTE_REPOSITORY');
