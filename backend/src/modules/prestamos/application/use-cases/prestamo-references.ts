import { BadRequestException, Inject, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CLIENTE_REPOSITORY, ClienteRepository } from '../../../clientes/domain/repositories/cliente.repository';
import { PERIODICIDAD_PAGO_REPOSITORY, PeriodicidadPagoRepository } from '../../../periodicidades-pago/domain/repositories/periodicidad-pago.repository';
import { FORMA_PAGO_REPOSITORY, FormaPagoRepository } from '../../../formas-pago/domain/repositories/forma-pago.repository';

export class PrestamoReferences {
  constructor(
    @Inject(CLIENTE_REPOSITORY) private readonly clientes: ClienteRepository,
    @Inject(PERIODICIDAD_PAGO_REPOSITORY) private readonly periodicidades: PeriodicidadPagoRepository,
    @Inject(FORMA_PAGO_REPOSITORY) private readonly formas: FormaPagoRepository,
  ) {}

  private async validarForma(formaPagoId: number): Promise<void> {
    const forma = await this.formas.buscarPorId(formaPagoId);
    if (!forma) throw new NotFoundException('Forma de pago no encontrada.');
    if (!forma.activo) throw new BadRequestException('La forma de pago seleccionada está inactiva.');
  }
  async validar(clienteId: number, periodicidadPagoId: number, formaPagoId: number, formaDesembolsoId?: number | null): Promise<void> {
    const cliente = await this.clientes.buscarPorId(clienteId);
    if (!cliente) throw new NotFoundException('Cliente no encontrado.');
    if (!cliente.activo) throw new BadRequestException('El cliente está inactivo y no puede recibir nuevos préstamos.');
    const periodicidad = await this.periodicidades.buscarPorId(periodicidadPagoId);
    if (!periodicidad) throw new NotFoundException('Periodicidad de pago no encontrada.');
    if (!periodicidad.activo) throw new BadRequestException('La periodicidad de pago seleccionada está inactiva.');
    await this.validarForma(formaPagoId);
    if (formaDesembolsoId !== undefined && formaDesembolsoId !== null) await this.validarForma(formaDesembolsoId);
  }
  async validarEnTransaccion(manager: EntityManager, clienteId: number, periodicidadPagoId: number, formaPagoId: number, formaDesembolsoId?: number | null): Promise<{ cliente: { id: number; nombre: string; identificacion?: string }; periodicidadPago: { id: number; nombre: string }; formaPago: { id: number; nombre: string }; formaDesembolso: { id: number; nombre: string } | null }> {
    const cliente = await this.clientes.buscarPorIdEnTransaccion(manager, clienteId);
    if (!cliente) throw new NotFoundException('Cliente no encontrado.');
    if (!cliente.activo) throw new BadRequestException('El cliente está inactivo y no puede recibir nuevos préstamos.');
    const periodicidad = await this.periodicidades.buscarPorIdEnTransaccion(manager, periodicidadPagoId);
    if (!periodicidad) throw new NotFoundException('Periodicidad de pago no encontrada.');
    if (!periodicidad.activo) throw new BadRequestException('La periodicidad de pago seleccionada está inactiva.');
    const forma = await this.formas.buscarPorIdEnTransaccion(manager, formaPagoId);
    if (!forma) throw new NotFoundException('Forma de pago no encontrada.');
    if (!forma.activo) throw new BadRequestException('La forma de pago seleccionada está inactiva.');
    const formaDesembolso = formaDesembolsoId == null ? null : await this.formas.buscarPorIdEnTransaccion(manager, formaDesembolsoId);
    if (formaDesembolsoId != null && !formaDesembolso) throw new NotFoundException('Forma de desembolso no encontrada.');
    if (formaDesembolsoId != null && !formaDesembolso!.activo) throw new BadRequestException('La forma de desembolso seleccionada está inactiva.');
    return { cliente: { id: cliente.id, nombre: [cliente.primerNombre, cliente.segundoNombre, cliente.primerApellido, cliente.segundoApellido].filter(Boolean).join(' '), identificacion: cliente.identificacion }, periodicidadPago: { id: periodicidad.id, nombre: periodicidad.nombre }, formaPago: { id: forma.id, nombre: forma.nombre }, formaDesembolso: formaDesembolso ? { id: formaDesembolso.id, nombre: formaDesembolso.nombre } : null };
  }
}
