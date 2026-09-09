import { EntityManager } from 'typeorm';
import { PagoAnulacion } from '../entities/pago-anulacion';

export interface PagoAnulacionRepository {
  guardarEnTransaccion(manager: EntityManager, anulacion: PagoAnulacion): Promise<PagoAnulacion>;
}

export const PAGO_ANULACION_REPOSITORY = Symbol('PAGO_ANULACION_REPOSITORY');
