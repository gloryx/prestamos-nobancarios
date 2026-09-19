import { EntityManager } from 'typeorm';
import { PuestaEnMarchaFinanciera } from '../puesta-en-marcha';

export interface PuestaEnMarchaPersistida { id: number; configuracionFinancieraId: number; usuarioConfirmacionId: number; fechaConfirmacion: Date; fechaCreacion: Date; puestaEnMarcha: PuestaEnMarchaFinanciera; }
export interface CrearPuestaEnMarchaPersistencia { configuracionFinancieraId: number; usuarioConfirmacionId: number; puestaEnMarcha: PuestaEnMarchaFinanciera; fechaConfirmacion?: Date; }
export interface PuestaEnMarchaRepository {
  findByConfiguracionId(manager: EntityManager, configuracionFinancieraId: number): Promise<PuestaEnMarchaPersistida | null>;
  existsByConfiguracionId(manager: EntityManager, configuracionFinancieraId: number): Promise<boolean>;
  create(manager: EntityManager, input: CrearPuestaEnMarchaPersistencia): Promise<PuestaEnMarchaPersistida>;
}
export const PUESTA_EN_MARCHA_REPOSITORY = Symbol('PUESTA_EN_MARCHA_REPOSITORY');
