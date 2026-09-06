import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CLIENTE_REPOSITORY, ClienteRepository } from '../../../clientes/domain/repositories/cliente.repository';
import { PLAN_PAGO_REPOSITORY, PlanPagoRepository } from '../../../planes-pago/domain/repositories/plan-pago.repository';
import { PRESTAMO_REPOSITORY, PrestamoRepository } from '../../domain/repositories/prestamo.repository';
import { PlanPagoPdfInfrastructureService } from '../../infrastructure/reports/plan-pago-pdf.infrastructure-service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PagoOrmEntity } from '../../../pagos/infrastructure/persistence/typeorm/pago.orm-entity';

@Injectable()
export class PlanPagoPdfService {
  constructor(
    @Inject(PRESTAMO_REPOSITORY) private readonly prestamos: PrestamoRepository,
    @Inject(CLIENTE_REPOSITORY) private readonly clientes: ClienteRepository,
    @Inject(PLAN_PAGO_REPOSITORY) private readonly planes: PlanPagoRepository,
    private readonly pdf: PlanPagoPdfInfrastructureService,
    @InjectRepository(PagoOrmEntity) private readonly pagos: Repository<PagoOrmEntity>,
  ) {}

  async execute(id: number): Promise<{ buffer: Buffer; identificacion: string }> {
    const prestamo = await this.prestamos.buscarPorId(id);
    if (!prestamo) throw new NotFoundException('Préstamo no encontrado.');
    const cliente = await this.clientes.buscarPorId(prestamo.clienteId);
    if (!cliente) throw new NotFoundException('Cliente del préstamo no encontrado.');
    const plan = await this.planes.buscarPorPrestamoId(id);
    if (plan.length === 0) throw new ConflictException('El préstamo no tiene un plan de pago persistido.');
    return { buffer: await this.pdf.generate(prestamo, cliente, plan, await this.applied(id)), identificacion: cliente.identificacion };
  }

  async executeEstadoCuenta(id: number): Promise<{ buffer: Buffer; identificacion: string }> {
    const prestamo = await this.prestamos.buscarPorId(id);
    if (!prestamo) throw new NotFoundException('Préstamo no encontrado.');
    const cliente = await this.clientes.buscarPorId(prestamo.clienteId);
    if (!cliente) throw new NotFoundException('Cliente del préstamo no encontrado.');
    const plan = await this.planes.buscarPorPrestamoId(id);
    if (!plan.length) throw new ConflictException('El préstamo no tiene un plan de pago persistido.');
    const applied = await this.applied(id);
    return { buffer: await this.pdf.generate(prestamo, cliente, plan, applied), identificacion: cliente.identificacion };
  }

  private async applied(id: number): Promise<Map<number, { total: number; fechas: string[] }>> {
    const rows = await this.pagos.createQueryBuilder('pago').innerJoin('pago.planPago', 'plan').select('pago.plan_pago_id', 'planPagoId').addSelect('COALESCE(SUM(pago.monto), 0)', 'total').addSelect('ARRAY_AGG(DISTINCT pago.fecha ORDER BY pago.fecha)', 'fechas').where('plan.prestamo_id = :id', { id }).andWhere('pago.plan_pago_id IS NOT NULL').groupBy('pago.plan_pago_id').getRawMany<{ planPagoId: string; total: string; fechas: string[] }>();
    const applied = new Map(rows.map(row => [Number(row.planPagoId), { total: Number(row.total), fechas: row.fechas ?? [] }]));
    return applied;
  }
}
