import { PeriodicidadPago } from '../entities/periodicidad-pago';
import { EntityManager } from 'typeorm';

export interface PeriodicidadPagoRepository {
  guardar(periodicidadPago: PeriodicidadPago): Promise<PeriodicidadPago>;
  buscarPorId(id: number): Promise<PeriodicidadPago | null>;
  buscarPorIdEnTransaccion(manager: EntityManager, id: number): Promise<PeriodicidadPago | null>;
  buscarPorNombre(nombre: string): Promise<PeriodicidadPago | null>;
  listar(): Promise<PeriodicidadPago[]>;
  actualizar(periodicidadPago: PeriodicidadPago): Promise<PeriodicidadPago>;
}

export const PERIODICIDAD_PAGO_REPOSITORY = Symbol('PERIODICIDAD_PAGO_REPOSITORY');
