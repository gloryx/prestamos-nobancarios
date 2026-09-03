import { Refinanciamiento } from '../../../domain/entities/refinanciamiento';
import { RefinanciamientoConRelaciones, RefinanciamientoRelacion } from '../../../domain/repositories/refinanciamiento.repository';
import { RefinanciamientoOrmEntity } from './refinanciamiento.orm-entity';
const date = (v: string | Date) => v instanceof Date ? new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate())) : new Date(`${v}T00:00:00.000Z`);
const relation = (p?: any): RefinanciamientoRelacion | undefined => p && ({ id: p.id, estado: p.estado, clienteId: p.clienteId, capital: p.capital, interes: p.interes, montoTotal: p.montoTotal, montoDesembolsado: p.montoDesembolsado });
export class RefinanciamientoMapper {
  static toDomain(e: RefinanciamientoOrmEntity): RefinanciamientoConRelaciones { return Object.assign(new Refinanciamiento(e.id, e.prestamoOrigenId, e.prestamoNuevoId, date(e.fecha), e.capitalPendiente, e.interesPendiente, e.montoRefinanciado, e.interesNuevo, e.observaciones, e.fechaCreacion), { prestamoOrigen: relation(e.prestamoOrigen), prestamoNuevo: relation(e.prestamoNuevo) }); }
  static toOrm(d: Refinanciamiento): RefinanciamientoOrmEntity { const e = new RefinanciamientoOrmEntity(); if (d.id !== null) e.id = d.id; e.prestamoOrigenId = d.prestamoOrigenId; e.prestamoNuevoId = d.prestamoNuevoId; e.fecha = d.fecha.toISOString().slice(0, 10); e.capitalPendiente = d.capitalPendiente; e.interesPendiente = d.interesPendiente; e.montoRefinanciado = d.montoRefinanciado; e.interesNuevo = d.interesNuevo; e.observaciones = d.observaciones; return e; }
}
