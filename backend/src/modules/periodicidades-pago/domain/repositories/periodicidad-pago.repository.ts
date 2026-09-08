import { PeriodicidadPago } from '../entities/periodicidad-pago';
import { EntityManager } from 'typeorm';

export interface FiltrosPeriodicidadesPagoAdministracion { pagina: number; limite: number; }
export interface PeriodicidadesPagoPaginadas { datos: PeriodicidadPago[]; pagina: number; limite: number; total: number; totalPaginas: number; }

export interface PeriodicidadPagoRepository {
  guardar(periodicidadPago: PeriodicidadPago): Promise<PeriodicidadPago>;
  buscarPorId(id: number): Promise<PeriodicidadPago | null>;
  buscarPorIdEnTransaccion(manager: EntityManager, id: number): Promise<PeriodicidadPago | null>;
  buscarPorNombre(nombre: string): Promise<PeriodicidadPago | null>;
  listar(): Promise<PeriodicidadPago[]>;
  listarAdministracion(filtros: FiltrosPeriodicidadesPagoAdministracion): Promise<PeriodicidadesPagoPaginadas>;
  actualizar(periodicidadPago: PeriodicidadPago): Promise<PeriodicidadPago>;
}

export const PERIODICIDAD_PAGO_REPOSITORY = Symbol('PERIODICIDAD_PAGO_REPOSITORY');
