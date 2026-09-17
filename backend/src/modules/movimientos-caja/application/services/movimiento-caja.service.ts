import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { EntityManager } from 'typeorm';
import { MovimientoCaja } from '../../domain/entities/movimiento-caja';
import { ConceptoMovimientoCaja } from '../../domain/enums/concepto-movimiento-caja.enum';
import { TipoMovimientoCaja } from '../../domain/enums/tipo-movimiento-caja.enum';
import { MOVIMIENTO_CAJA_REPOSITORY, MovimientoCajaRepository } from '../../domain/repositories/movimiento-caja.repository';
import { USUARIO_REPOSITORY, UsuarioRepository } from '../../../usuarios/domain/repositories/usuario.repository';
import { FinancialPeriodService } from '../../../cierre-financiero/application/financial-period.service';
import { FORMA_PAGO_REPOSITORY, FormaPagoRepository } from '../../../formas-pago/domain/repositories/forma-pago.repository';
import { economicDateOnly } from '../../../../common/economic-date';

const manuales = new Set([ConceptoMovimientoCaja.APORTE_CAPITAL, ConceptoMovimientoCaja.RETIRO, ConceptoMovimientoCaja.GASTO, ConceptoMovimientoCaja.AJUSTE_ENTRADA, ConceptoMovimientoCaja.AJUSTE_SALIDA]);
const direccion = (concepto: ConceptoMovimientoCaja) => concepto === ConceptoMovimientoCaja.PAGO_CLIENTE || concepto === ConceptoMovimientoCaja.APORTE_CAPITAL || concepto === ConceptoMovimientoCaja.AJUSTE_ENTRADA ? TipoMovimientoCaja.ENTRADA : TipoMovimientoCaja.SALIDA;

@Injectable()
export class MovimientoCajaService {
  constructor(@Inject(MOVIMIENTO_CAJA_REPOSITORY) private readonly repo: MovimientoCajaRepository, @Inject(USUARIO_REPOSITORY) private readonly users: UsuarioRepository, @Optional() private readonly periods?: FinancialPeriodService, @Optional() @Inject(FORMA_PAGO_REPOSITORY) private readonly formas?: FormaPagoRepository) {}

  async validarActor(manager: EntityManager, usuarioId: number): Promise<void> {
    if (!Number.isInteger(usuarioId) || usuarioId < 1) throw new UnauthorizedException('Se requiere una identidad autenticada para operar caja.');
    const usuario = await this.users.buscarPorIdEnTransaccion(manager, usuarioId);
    if (!usuario) throw new NotFoundException('Usuario actor no encontrado.');
    if (!usuario.activo) throw new BadRequestException('El usuario actor está inactivo.');
  }

  async crearManual(manager: EntityManager, data: { concepto: ConceptoMovimientoCaja; monto: number; fecha: Date; observaciones?: string | null; formaPagoId?: number | null; usuarioId: number; idempotencyKey?: string | null }) {
    if (this.periods) await this.periods.assertOpen(manager, data.fecha);
    if (economicDateOnly(data.fecha) > economicDateOnly()) throw new BadRequestException('La fecha económica no puede ser posterior a la fecha económica actual.');
    if (!manuales.has(data.concepto)) throw new BadRequestException('El concepto seleccionado es automático y no puede registrarse manualmente.');
    if ((data.concepto === ConceptoMovimientoCaja.AJUSTE_ENTRADA || data.concepto === ConceptoMovimientoCaja.AJUSTE_SALIDA) && !data.observaciones?.trim()) throw new BadRequestException('Las observaciones son obligatorias para los ajustes.');
    const requiresForm = data.concepto === ConceptoMovimientoCaja.APORTE_CAPITAL || data.concepto === ConceptoMovimientoCaja.RETIRO || data.concepto === ConceptoMovimientoCaja.GASTO;
    if (requiresForm && this.formas && (!Number.isInteger(data.formaPagoId) || data.formaPagoId < 1)) throw new BadRequestException('formaPagoId es obligatorio para este concepto.');
    if (data.formaPagoId != null) {
      if (!Number.isSafeInteger(data.formaPagoId) || data.formaPagoId < 1 || data.formaPagoId > 32767) throw new NotFoundException('La forma de pago no existe.');
      if (!this.formas) throw new Error('El repositorio de formas de pago no está configurado.');
      const forma = await this.formas.buscarPorIdEnTransaccion(manager, data.formaPagoId);
      if (!forma) throw new NotFoundException('La forma de pago no existe.');
      if (!forma.activo) throw new BadRequestException('La forma de pago está inactiva.');
    }
    await this.validarActor(manager, data.usuarioId);
    const key = data.idempotencyKey?.trim() || null;
    const value = MovimientoCaja.crear({ ...data, tipo: direccion(data.concepto), observaciones: data.observaciones?.trim() || null, formaPagoId: data.formaPagoId ?? null, idempotencyKey: key });
    if (!key) return this.repo.guardarEnTransaccion(manager, value);
    if (key.length > 128 || !/^[\x21-\x7E]+$/.test(key)) throw new BadRequestException('Idempotency-Key debe ser una cadena ASCII visible de 1 a 128 caracteres después de recortar espacios.');
    const fingerprint = createHash('sha256').update(JSON.stringify({ actor: data.usuarioId, endpoint: '/movimientos-caja', concepto: data.concepto, monto: data.monto.toFixed(2), fecha: economicDateOnly(data.fecha), observaciones: data.observaciones?.trim() || null, formaPagoId: data.formaPagoId ?? null })).digest('hex');
    const result = await this.repo.guardarManualIdempotente(manager, value, fingerprint);
    if (result.fingerprint !== fingerprint) throw new ConflictException('El Idempotency-Key ya fue utilizado con una solicitud diferente.');
    return result.movement;
  }

  async automatico(manager: EntityManager, data: { tipo: TipoMovimientoCaja; concepto: ConceptoMovimientoCaja; monto: number; fecha: Date; observaciones?: string | null; pagoId?: number | null; formaPagoId?: number | null; prestamoId?: number | null; refinanciamientoId?: number | null; movimientoReversadoId?: number | null; usuarioId: number }) {
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
    if (economicDateOnly(fecha) > economicDateOnly()) throw new BadRequestException('La fecha económica no puede ser posterior a la fecha económica actual.');
    await this.validarActor(manager, usuarioId);
    if (!observaciones?.trim()) throw new BadRequestException('Las observaciones son obligatorias para reversar.');
    const original = await this.repo.buscarPorIdEnTransaccion(manager, id, true);
    if (!original) throw new NotFoundException('Movimiento de caja no encontrado.');
    if (original.concepto === ConceptoMovimientoCaja.REVERSO) throw new BadRequestException('No se puede reversar un reverso.');
    if (!manuales.has(original.concepto)) throw new BadRequestException('Los movimientos automáticos no pueden reversarse.');
    const reversals = await this.repo.contarReversionesEnTransaccion(manager, id);
    if (reversals > 0) throw new ConflictException('El movimiento ya fue reversado.');
    try { return await this.repo.guardarEnTransaccion(manager, MovimientoCaja.crear({ tipo: original.tipo === TipoMovimientoCaja.ENTRADA ? TipoMovimientoCaja.SALIDA : TipoMovimientoCaja.ENTRADA, concepto: ConceptoMovimientoCaja.REVERSO, monto: original.monto, fecha, observaciones: observaciones.trim(), pagoId: null, prestamoId: null, refinanciamientoId: null, movimientoReversadoId: id, formaPagoId: original.formaPagoId, usuarioId })); } catch (error) { if (typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505') throw new ConflictException('El movimiento ya fue reversado.'); throw error; }
  }

  async reversarPagoCliente(manager: EntityManager, pagoId: number, fecha: Date, observaciones: string, usuarioId: number) {
    if (this.periods) await this.periods.assertOpen(manager, fecha);
    await this.validarActor(manager, usuarioId);
    const original = await this.repo.buscarPorPagoYConceptoEnTransaccion(manager, pagoId, ConceptoMovimientoCaja.PAGO_CLIENTE);
    if (!original) throw new NotFoundException('Movimiento original de pago no encontrado.');
    const locked = await this.repo.buscarPorIdEnTransaccion(manager, original.id!, true);
    if (!locked || locked.concepto !== ConceptoMovimientoCaja.PAGO_CLIENTE) throw new BadRequestException('El movimiento original del pago no es válido.');
    if (await this.repo.contarReversionesEnTransaccion(manager, original.id!)) throw new ConflictException('El movimiento del pago ya fue reversado.');
    try {
      return await this.repo.guardarEnTransaccion(manager, MovimientoCaja.crear({ tipo: TipoMovimientoCaja.SALIDA, concepto: ConceptoMovimientoCaja.REVERSO, monto: original.monto, fecha, observaciones: observaciones.trim(), pagoId, prestamoId: original.prestamoId, refinanciamientoId: null, movimientoReversadoId: original.id, formaPagoId: original.formaPagoId, usuarioId }));
    } catch (error) {
      if (typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505') throw new ConflictException('El movimiento del pago ya fue reversado.');
      throw error;
    }
  }

  async reversarDesembolsoPrestamoPorAnulacion(manager: EntityManager, prestamoId: number, fecha: Date, observaciones: string, usuarioId: number) {
    if (this.periods) await this.periods.assertOpen(manager, fecha);
    await this.validarActor(manager, usuarioId);
    if (!observaciones?.trim()) throw new BadRequestException('Las observaciones son obligatorias para anular un préstamo.');
    const original = await this.repo.buscarPorPrestamoYConceptoEnTransaccion(manager, prestamoId, ConceptoMovimientoCaja.DESEMBOLSO_PRESTAMO);
    if (!original) throw new NotFoundException('Desembolso original del préstamo no encontrado.');
    const locked = await this.repo.buscarPorIdEnTransaccion(manager, original.id!, true);
    if (!locked || locked.concepto !== ConceptoMovimientoCaja.DESEMBOLSO_PRESTAMO || locked.prestamoId !== prestamoId) throw new BadRequestException('El desembolso original no es válido para anulación.');
    if (await this.repo.contarReversionesEnTransaccion(manager, locked.id!)) throw new ConflictException('El desembolso del préstamo ya fue reversado.');
    try {
      return await this.repo.guardarEnTransaccion(manager, MovimientoCaja.crear({
        tipo: locked.tipo === TipoMovimientoCaja.ENTRADA ? TipoMovimientoCaja.SALIDA : TipoMovimientoCaja.ENTRADA,
        concepto: ConceptoMovimientoCaja.REVERSO,
        monto: locked.monto,
        fecha,
        observaciones: observaciones.trim(),
        pagoId: null,
        prestamoId: locked.prestamoId,
        refinanciamientoId: null,
        movimientoReversadoId: locked.id,
        formaPagoId: locked.formaPagoId,
        usuarioId,
      }));
    } catch (error) {
      if (typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505') throw new ConflictException('El desembolso del préstamo ya fue reversado.');
      throw error;
    }
  }
}
