import { FuenteIngreso } from '../entities/fuente-ingreso';
export const FUENTE_INGRESO_REPOSITORY = Symbol('FUENTE_INGRESO_REPOSITORY');
export { INGRESO_REPOSITORY } from './ingreso.repository';
export interface FuenteIngresoRepository { guardar(value: FuenteIngreso): Promise<FuenteIngreso>; buscarPorId(id: number): Promise<FuenteIngreso | null>; buscarPorNombre(nombre: string): Promise<FuenteIngreso | null>; listar(activo?: boolean): Promise<FuenteIngreso[]>; }
