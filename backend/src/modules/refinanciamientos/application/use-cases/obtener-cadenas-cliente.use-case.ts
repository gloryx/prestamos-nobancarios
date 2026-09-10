import { ConflictException, Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { DatosCadenasCliente, PrestamoCadena, REFINANCIAMIENTO_REPOSITORY, RefinanciamientoConRelaciones, RefinanciamientoRepository } from '../../domain/repositories/refinanciamiento.repository';
import { Cliente } from '../../../clientes/domain/entities/cliente';
import { calcularDiasGanados } from '../services/calcular-dias-ganados';

export interface CadenaPrestamoResponse { id: number; clienteId: number; estado: string; fechaAlta: string; capital: number; interes: number; montoTotal: number; montoDesembolsado: number; }
export interface TransicionCadenaResponse { refinanciamientoId: number; fecha: string; prestamoOrigenId: number; prestamoNuevoId: number; capitalTrasladado: number; dineroNuevoDesembolsado: number; interesNuevo: number; fechaLimiteContractualOrigen: string | null; diasGanados: number | null; }
export interface CadenaResponse { prestamoRaizId: number; prestamoTerminalId: number; fechaInicio: string; resumen: { cantidadPrestamos: number; cantidadRefinanciamientos: number; capitalInicial: number; capitalTerminal: number; totalCapitalTrasladado: number; totalDineroNuevoDesembolsado: number; montoRealmenteEntregado: number; montoRealmenteRecibido: number; efectivoNetoRecuperado: number; totalInteresNuevoPactado: number; diasGanadosAcumulados: number; diasGanadosCompletos: boolean; fechaUltimoRefinanciamiento: string; }; prestamos: CadenaPrestamoResponse[]; transiciones: TransicionCadenaResponse[]; }
export interface CadenasClienteResponse { cliente: ReturnType<typeof clienteResponse>; convencionOrdenFechaInicio: string; resumen: { cantidadCadenas: number; cantidadRefinanciamientos: number; totalCapitalTrasladado: number; totalDineroNuevoDesembolsado: number; montoRealmenteEntregado: number; montoRealmenteRecibido: number; efectivoNetoRecuperado: number; totalInteresNuevoPactado: number; diasGanadosAcumulados: number; diasGanadosCompletos: boolean; }; cadenas: CadenaResponse[]; }

const money = (value: number) => Math.round(Number(value || 0) * 100) / 100;
const add = (a: number, b: number) => money(money(a) + money(b));
const dateOnly = (value: Date) => value.toISOString().slice(0, 10);
const clienteResponse = (c: Cliente) => ({ id: c.id!, identificacion: c.identificacion, primerNombre: c.primerNombre, segundoNombre: c.segundoNombre, primerApellido: c.primerApellido, segundoApellido: c.segundoApellido, genero: c.genero, fechaNacimiento: c.fechaNacimiento ? dateOnly(c.fechaNacimiento) : null, direccion: c.direccion, correo: c.correo, telefono1: c.telefono1, telefono2: c.telefono2, nacionalidad: c.nacionalidad, observaciones: c.observaciones, fechaIngreso: c.fechaIngreso, urlIdentificacion: c.urlIdentificacion, activo: c.activo });

const loanResponse = (p: PrestamoCadena): CadenaPrestamoResponse => ({ ...p, fechaAlta: dateOnly(p.fechaAlta), capital: money(p.capital), interes: money(p.interes), montoTotal: money(p.montoTotal), montoDesembolsado: money(p.montoDesembolsado) });
const transition = (r: RefinanciamientoConRelaciones): TransicionCadenaResponse => ({ refinanciamientoId: r.id!, fecha: dateOnly(r.fecha), prestamoOrigenId: r.prestamoOrigenId, prestamoNuevoId: r.prestamoNuevoId, capitalTrasladado: money(r.capitalPendiente), dineroNuevoDesembolsado: money(r.prestamoNuevo?.montoDesembolsado ?? 0), interesNuevo: money(r.interesNuevo), fechaLimiteContractualOrigen: r.fechaLimiteContractualOrigen ? dateOnly(r.fechaLimiteContractualOrigen) : null, diasGanados: calcularDiasGanados(r.fechaLimiteContractualOrigen, r.fecha) });

@Injectable()
export class ObtenerCadenasClienteUseCase {
  constructor(@Inject(REFINANCIAMIENTO_REPOSITORY) private readonly repository: RefinanciamientoRepository) {}

  async execute(clienteId: number): Promise<CadenasClienteResponse> {
    const data = await this.repository.buscarDatosCadenasPorClienteId(clienteId);
    if (!data) throw new NotFoundException('Cliente no encontrado.');
    return this.build(data);
  }

  build(data: DatosCadenasCliente): CadenasClienteResponse {
    const pagosPorPrestamo = data.pagosPorPrestamo ?? {};
    const loans = new Map(data.prestamos.map(p => [p.id, p]));
    const byOrigin = new Map<number, RefinanciamientoConRelaciones>();
    const byNew = new Map<number, RefinanciamientoConRelaciones>();
    for (const relation of data.refinanciamientos) {
      if (!loans.has(relation.prestamoOrigenId) || !loans.has(relation.prestamoNuevoId) || loans.get(relation.prestamoOrigenId)!.clienteId !== data.cliente.id || loans.get(relation.prestamoNuevoId)!.clienteId !== data.cliente.id) throw new ConflictException('Relación de refinanciamiento cruzada entre clientes.');
      if (byOrigin.has(relation.prestamoOrigenId)) throw new ConflictException('Corrupción estructural: un préstamo tiene más de un sucesor.');
      if (byNew.has(relation.prestamoNuevoId)) throw new ConflictException('Corrupción estructural: un préstamo tiene más de un origen.');
      byOrigin.set(relation.prestamoOrigenId, relation); byNew.set(relation.prestamoNuevoId, relation);
    }
    const roots = [...byOrigin.keys()].filter(id => !byNew.has(id)).sort((a, b) => a - b);
    const chains: CadenaResponse[] = [];
    const seen = new Set<number>();
    for (const rootId of roots) {
      const chainRelations: RefinanciamientoConRelaciones[] = [];
      const chainLoans: PrestamoCadena[] = [loans.get(rootId)!];
      const chainSeen = new Set<number>(); let current = rootId;
      while (byOrigin.has(current)) {
        if (chainSeen.has(current)) throw new ConflictException('Corrupción estructural: ciclo en cadena de refinanciamiento.');
        chainSeen.add(current); const relation = byOrigin.get(current)!;
        if (seen.has(relation.id!)) throw new ConflictException('Corrupción estructural: relación duplicada en cadenas.');
        seen.add(relation.id!); chainRelations.push(relation); current = relation.prestamoNuevoId; chainLoans.push(loans.get(current)!);
      }
      const terminal = loans.get(current)!;
      const transitions = chainRelations.map(transition);
       const montoRealmenteEntregado = chainRelations.reduce((n, r) => add(n, r.prestamoNuevo?.montoDesembolsado ?? 0), money(chainLoans[0].montoDesembolsado));
       const montoRealmenteRecibido = chainLoans.reduce((n, loan) => add(n, pagosPorPrestamo[loan.id] ?? 0), 0);
       chains.push({ prestamoRaizId: rootId, prestamoTerminalId: terminal.id, fechaInicio: dateOnly(chainLoans[0].fechaAlta), resumen: { cantidadPrestamos: chainLoans.length, cantidadRefinanciamientos: chainRelations.length, capitalInicial: money(chainLoans[0].capital), capitalTerminal: money(terminal.capital), totalCapitalTrasladado: chainRelations.reduce((n, r) => add(n, r.capitalPendiente), 0), totalDineroNuevoDesembolsado: chainRelations.reduce((n, r) => add(n, r.prestamoNuevo?.montoDesembolsado ?? 0), 0), montoRealmenteEntregado, montoRealmenteRecibido, efectivoNetoRecuperado: add(montoRealmenteRecibido, -montoRealmenteEntregado), totalInteresNuevoPactado: chainRelations.reduce((n, r) => add(n, r.interesNuevo), 0), diasGanadosAcumulados: transitions.reduce((n, t) => t.diasGanados === null ? n : n + t.diasGanados, 0), diasGanadosCompletos: transitions.every(t => t.diasGanados !== null), fechaUltimoRefinanciamiento: transitions.at(-1)!.fecha }, prestamos: chainLoans.map(loanResponse), transiciones: transitions });
    }
    if (seen.size !== data.refinanciamientos.length) throw new ConflictException('Corrupción estructural: ciclo o componente no alcanzable.');
    chains.sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio) || a.prestamoRaizId - b.prestamoRaizId);
      const summary = chains.reduce((s, c) => ({ cantidadCadenas: s.cantidadCadenas + 1, cantidadRefinanciamientos: s.cantidadRefinanciamientos + c.resumen.cantidadRefinanciamientos, totalCapitalTrasladado: add(s.totalCapitalTrasladado, c.resumen.totalCapitalTrasladado), totalDineroNuevoDesembolsado: add(s.totalDineroNuevoDesembolsado, c.resumen.totalDineroNuevoDesembolsado), montoRealmenteEntregado: add(s.montoRealmenteEntregado, c.resumen.montoRealmenteEntregado), montoRealmenteRecibido: add(s.montoRealmenteRecibido, c.resumen.montoRealmenteRecibido), efectivoNetoRecuperado: add(s.efectivoNetoRecuperado, c.resumen.efectivoNetoRecuperado), totalInteresNuevoPactado: add(s.totalInteresNuevoPactado, c.resumen.totalInteresNuevoPactado), diasGanadosAcumulados: s.diasGanadosAcumulados + c.resumen.diasGanadosAcumulados, diasGanadosCompletos: s.diasGanadosCompletos && c.resumen.diasGanadosCompletos }), { cantidadCadenas: 0, cantidadRefinanciamientos: 0, totalCapitalTrasladado: 0, totalDineroNuevoDesembolsado: 0, montoRealmenteEntregado: 0, montoRealmenteRecibido: 0, efectivoNetoRecuperado: 0, totalInteresNuevoPactado: 0, diasGanadosAcumulados: 0, diasGanadosCompletos: true });
    return { cliente: clienteResponse(data.cliente), convencionOrdenFechaInicio: 'fechaAlta del préstamo raíz; desempate por prestamoRaizId ASC.', resumen: summary, cadenas: chains };
  }
}
