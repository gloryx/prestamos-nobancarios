import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { MovimientoCaja } from '../../domain/entities/movimiento-caja';
import { ConceptoMovimientoCaja } from '../../domain/enums/concepto-movimiento-caja.enum';
import { TipoMovimientoCaja } from '../../domain/enums/tipo-movimiento-caja.enum';
import { MOVIMIENTO_CAJA_REPOSITORY, MovimientoCajaRepository } from '../../domain/repositories/movimiento-caja.repository';
import { USUARIO_REPOSITORY, UsuarioRepository } from '../../../usuarios/domain/repositories/usuario.repository';
import { FinancialPeriodService } from '../../../cierre-financiero/application/financial-period.service';

const manuales = new Set([ConceptoMovimientoCaja.APORTE_CAPITAL, ConceptoMovimientoCaja.RETIRO, ConceptoMovimientoCaja.GASTO, ConceptoMovimientoCaja.AJUSTE_ENTRADA, ConceptoMovimientoCaja.AJUSTE_SALIDA]);
const direccion = (concepto: ConceptoMovimientoCaja) => concepto === ConceptoMovimientoCaja.PAGO_CLIENTE || concepto === ConceptoMovimientoCaja.APORTE_CAPITAL || concepto === ConceptoMovimientoCaja.AJUSTE_ENTRADA ? TipoMovimientoCaja.ENTRADA : TipoMovimientoCaja.SALIDA;

@Injectable()
export class MovimientoCajaService {
  constructor(@Inject(MOVIMIENTO_CAJA_REPOSITORY) private readonly repo: MovimientoCajaRepository, @Inject(USUARIO_REPOSITORY) private readonly users: UsuarioRepository, private readonly periods?: FinancialPeriodService) {}

  async validarActor(manager: EntityManager, usuarioId: number): Promise<void> {
    if (!Number.isInteger(usuarioId) || usuarioId < 1) throw new UnauthorizedException('Se requiere una identidad autenticada para operar caja.');
    const usuario = await this.users.buscarPorIdEnTransaccion(manager, usuarioId);
    if (!usuario) throw new NotFoundException('Usuario actor no encontrado.');
    if (!usuario.activo) throw new BadRequestException('El usuario actor está inactivo.');
  }

  async crearManual(manager: EntityManager, data: { concepto: ConceptoMovimientoCaja; monto: number; fecha: Date; observaciones?: string | null; usuarioId: number }) {
    if (this.periods) await this.periods.assertOpen(manager, data.fecha);
    if (!manuales.has(data.concepto)) throw new BadRequestException('El concepto seleccionado es automático y no puede registrarse manualmente.');
    if ((data.concepto === ConceptoMovimientoCaja.AJUSTE_ENTRADA || data.concepto === ConceptoMovimientoCaja.AJUSTE_SALIDA) && !data.observaciones?.trim()) throw new BadRequestException('Las observaciones son obligatorias para los ajustes.');
    await this.validarActor(manager, data.usuarioId);
    return this.repo.guardarEnTransaccion(manager, MovimientoCaja.crear({ ...data, tipo: direccion(data.concepto), observaciones: data.observaciones?.trim() || null }));
  }

  async automatico(manager: EntityManager, data: { tipo: TipoMovimientoCaja; concepto: ConceptoMovimientoCaja; monto: number; fecha: Date; observaciones?: string | null; pagoId?: number | null; prestamoId?: number | null; refinanciamientoId?: number | null; movimientoReversadoId?: number | null; usuarioId: number }) {
    if (this.periods) await this.periods.assertOpen(manager, data.fecha);
    await this.validarActor(manager, data.usuarioId);
    if (manuales.has(data.concepto)) throw new BadRequestException('Los conceptos manuales deben registrarse mediante el flujo manual.');
    if (data.concepto === ConceptoMovimientoCaja.REVERSO) throw new BadRequestException('Los reversos solo pueden crearse mediante la operación de reversión.');
    if (data.tipo !== direccion(data.concepto)) throw new BadRequestException('La dirección del movimiento no corresponde al concepto.');
    if (data.concepto === ConceptoMovimientoCaja.PAGO_CLIENTE && (!data.pagoId || !data.prestamoId)) throw new BadRequestException('PAGO_CLIENTE requiere pagoId y prestamoId.');
    if (data.concepto === ConceptoMovimientoCaja.DESEMBOLSO_PRESTAMO && !data.prestamoId) throw new BadRequestException('DESEMBOLSO_PRESTAMO requiere prestamoId.');
    if (data.concepto === ConceptoMovimientoCaja.DESEMBOLSO_REFINANCIAMIENTO && (!data.prestamoId || !data.refinanciamientoId)) throw new BadRequestException('DESEMBOLSO_REFINANCIAMIENTO requiere prestamoId y refinanciamientoId.');
    if (data.pagoId && data.concepto !== ConceptoMovimientoCaja.PAGO_CLIENTE) throw new BadRequestException('pagoId solo corresponde a PAGO_CLIENTE.');
    if (data.refinanciamientoId && data.concepto !== ConceptoMovimientoCaja.DESEMBOLSO_REFINANCIAMIENTO) throw new BadRequestException('refinanciamientoId solo corresponde a desembolso de refinanciamiento.');
    if (data.concepto === ConceptoMovimientoCaja.PAGO_CLIENTE && data.refinanciamientoId) throw new BadRequestException('PAGO_CLIENTE no admite refinanciamientoId.');
    if (data.concepto === ConceptoMovimientoCaja.DESEMBOLSO_PRESTAMO && data.refinanciamientoId) throw new BadRequestException('DESEMBOLSO_PRESTAMO no admite refinanciamientoId.');
    if (data.movimientoReversadoId) throw new BadRequestException('Los movimientos automáticos no pueden crear vínculos de reversión.');
    const existing = data.pagoId ? await this.repo.buscarPorPagoYConceptoEnTransaccion(manager, data.pagoId, data.concepto) : data.refinanciamientoId ? await this.repo.buscarPorRefinanciamientoYConceptoEnTransaccion(manager, data.refinanciamientoId, data.concepto) : data.prestamoId ? await this.repo.buscarPorPrestamoYConceptoEnTransaccion(manager, data.prestamoId, data.concepto) : null;
    if (existing) throw new ConflictException('El movimiento automático ya existe.');
    try { return await this.repo.guardarEnTransaccion(manager, MovimientoCaja.crear({ ...data, observaciones: data.observaciones?.trim() || null })); } catch (error) { if (typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505') throw new ConflictException('El movimiento automático ya existe.'); throw error; }
  }

  async reversar(manager: EntityManager, id: number, fecha: Date, observaciones: string, usuarioId: number) {
    if (this.periods) await this.periods.assertOpen(manager, fecha);
    await this.validarActor(manager, usuarioId);
    if (!observaciones?.trim()) throw new BadRequestException('Las observaciones son obligatorias para reversar.');
    const original = await this.repo.buscarPorIdEnTransaccion(manager, id, true);
    if (!original) throw new NotFoundException('Movimiento de caja no encontrado.');
    if (original.concepto === ConceptoMovimientoCaja.REVERSO) throw new BadRequestException('No se puede reversar un reverso.');
    if (!manuales.has(original.concepto)) throw new BadRequestException('Los movimientos automáticos no pueden reversarse.');
    const reversals = await this.repo.contarReversionesEnTransaccion(manager, id);
    if (reversals > 0) throw new ConflictException('El movimiento ya fue reversado.');
    try { return await this.repo.guardarEnTransaccion(manager, MovimientoCaja.crear({ tipo: original.tipo === TipoMovimientoCaja.ENTRADA ? TipoMovimientoCaja.SALIDA : TipoMovimientoCaja.ENTRADA, concepto: ConceptoMovimientoCaja.REVERSO, monto: original.monto, fecha, observaciones: observaciones.trim(), pagoId: null, prestamoId: null, refinanciamientoId: null, movimientoReversadoId: id, usuarioId })); } catch (error) { if (typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505') throw new ConflictException('El movimiento ya fue reversado.'); throw error; }
  }
}
