import { FormaPago } from '../entities/forma-pago';
import { EntityManager } from 'typeorm';

export interface FormaPagoRepository {
  guardar(formaPago: FormaPago): Promise<FormaPago>;
  buscarPorId(id: number): Promise<FormaPago | null>;
  buscarPorIdEnTransaccion(manager: EntityManager, id: number): Promise<FormaPago | null>;
  buscarPorNombre(nombre: string): Promise<FormaPago | null>;
  listar(): Promise<FormaPago[]>;
  actualizar(formaPago: FormaPago): Promise<FormaPago>;
}

export const FORMA_PAGO_REPOSITORY = Symbol('FORMA_PAGO_REPOSITORY');
