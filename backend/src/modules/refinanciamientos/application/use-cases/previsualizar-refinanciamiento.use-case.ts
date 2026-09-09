import { InjectDataSource } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ClienteOrmEntity } from '../../../clientes/infrastructure/persistence/typeorm/cliente.orm-entity';
import { PagoOrmEntity } from '../../../pagos/infrastructure/persistence/typeorm/pago.orm-entity';
import { PrestamoOrmEntity } from '../../../prestamos/infrastructure/persistence/typeorm/prestamo.orm-entity';
import { calcularElegibilidadRefinanciamiento } from '../services/calcular-elegibilidad-refinanciamiento';

const dateOnly = (value: string | Date): string => value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);

@Injectable()
export class PrevisualizarRefinanciamientoUseCase {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async execute(prestamoId: number) {
    const prestamo = await this.dataSource.getRepository(PrestamoOrmEntity)
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.cliente', 'cliente')
      .where('p.id = :id', { id: prestamoId })
      .getOne();
    if (!prestamo) throw new NotFoundException('Préstamo no encontrado.');

    const totals = await this.dataSource.getRepository(PagoOrmEntity)
      .createQueryBuilder('pago')
      .select('COALESCE(SUM(pago.monto), 0)', 'totalPagado')
      .where('pago.prestamo_id = :id', { id: prestamo.id })
      .andWhere("pago.estado = 'REGISTRADO'")
      .getRawOne<{ totalPagado: string }>();
    const calculo = calcularElegibilidadRefinanciamiento({
      estado: prestamo.estado,
      capital: prestamo.capital,
      interes: prestamo.interes,
      totalPagado: Number(totals?.totalPagado ?? 0),
    });
    const cliente = prestamo.cliente as ClienteOrmEntity;
    if (!cliente) throw new NotFoundException('Préstamo no encontrado.');

    return {
      elegible: calculo.elegible,
      motivo: calculo.motivo,
      cliente: {
        id: cliente.id,
        identificacion: cliente.identificacion,
        nombreCompleto: [cliente.primerNombre, cliente.segundoNombre, cliente.primerApellido, cliente.segundoApellido].filter(Boolean).join(' '),
      },
      prestamo: {
        id: prestamo.id,
        estado: prestamo.estado,
        fechaAlta: dateOnly(prestamo.fechaAlta),
        capital: prestamo.capital,
        interes: prestamo.interes,
        montoTotal: prestamo.montoTotal,
      },
      totalPagado: calculo.totalPagado,
      interesRequerido: calculo.interesRequerido,
      interesPendienteParaRefinanciar: calculo.interesPendienteParaRefinanciar,
      capitalAmortizadoRefinanciamiento: calculo.capitalAmortizadoRefinanciamiento,
      capitalPendienteRefinanciable: calculo.capitalPendienteRefinanciable,
    };
  }
}
