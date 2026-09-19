import { PuestaEnMarchaFinanciera, SaldoPuestaEnMarcha } from '../../../domain/puesta-en-marcha';
import { PuestaMarchaFinancieraOrmEntity, PuestaMarchaFinancieraSaldoOrmEntity } from './puesta-en-marcha.orm-entities';

export class PuestaEnMarchaMapper {
  private static dateOnly(value: string | Date): string {
    if (typeof value === 'string') return value.slice(0, 10);
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
  }
  static saldoToDomain(entity: PuestaMarchaFinancieraSaldoOrmEntity): SaldoPuestaEnMarcha {
    return { concepto: entity.concepto, monto: Number(entity.monto), procedencia: entity.procedencia, ...(entity.evidencia == null ? {} : { evidencia: entity.evidencia }), ...(entity.observacion == null ? {} : { observacion: entity.observacion }) };
  }
  static toDomain(entity: PuestaMarchaFinancieraOrmEntity): PuestaEnMarchaFinanciera {
    return { modalidad: entity.modalidad, fechaBase: this.dateOnly(entity.fechaBase), fechaInicioCierres: this.dateOnly(entity.fechaInicioCierres), saldos: (entity.saldos ?? []).map((saldo) => this.saldoToDomain(saldo)), ...(entity.observaciones == null ? {} : { observaciones: entity.observaciones }) };
  }
  static saldoToOrm(domain: SaldoPuestaEnMarcha, puestaMarchaId: number): PuestaMarchaFinancieraSaldoOrmEntity {
    const entity = new PuestaMarchaFinancieraSaldoOrmEntity(); entity.puestaMarchaId = puestaMarchaId; entity.concepto = domain.concepto; entity.monto = Number(domain.monto); entity.procedencia = domain.procedencia; entity.evidencia = domain.evidencia ?? null; entity.observacion = domain.observacion ?? null; return entity;
  }
  static toOrm(domain: PuestaEnMarchaFinanciera, configuracionFinancieraId: number, usuarioConfirmacionId: number, fechaConfirmacion: Date): PuestaMarchaFinancieraOrmEntity {
    const entity = new PuestaMarchaFinancieraOrmEntity(); entity.configuracionFinancieraId = configuracionFinancieraId; entity.fechaBase = domain.fechaBase; entity.fechaInicioCierres = domain.fechaInicioCierres; entity.modalidad = domain.modalidad; entity.usuarioConfirmacionId = usuarioConfirmacionId; entity.fechaConfirmacion = fechaConfirmacion; entity.observaciones = domain.observaciones ?? null; return entity;
  }
}
