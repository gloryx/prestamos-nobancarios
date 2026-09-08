import { FormaPago } from '../entities/forma-pago';
import { EntityManager } from 'typeorm';

export interface FiltrosFormasPagoAdministracion { pagina: number; limite: number; }
export interface FormasPagoPaginadas { datos: FormaPago[]; pagina: number; limite: number; total: number; totalPaginas: number; }

export interface FormaPagoRepository {
  guardar(formaPago: FormaPago): Promise<FormaPago>;
  buscarPorId(id: number): Promise<FormaPago | null>;
  buscarPorIdEnTransaccion(manager: EntityManager, id: number): Promise<FormaPago | null>;
  buscarPorNombre(nombre: string): Promise<FormaPago | null>;
  listar(): Promise<FormaPago[]>;
  listarAdministracion(filtros: FiltrosFormasPagoAdministracion): Promise<FormasPagoPaginadas>;
  actualizar(formaPago: FormaPago): Promise<FormaPago>;
}

export const FORMA_PAGO_REPOSITORY = Symbol('FORMA_PAGO_REPOSITORY');
