import { InjectDataSource } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ClienteOrmEntity } from '../../../clientes/infrastructure/persistence/typeorm/cliente.orm-entity';
import { PagoOrmEntity } from '../../../pagos/infrastructure/persistence/typeorm/pago.orm-entity';
import { PrestamoOrmEntity } from '../../../prestamos/infrastructure/persistence/typeorm/prestamo.orm-entity';
import { EstadoPrestamo } from '../../../prestamos/domain/enums/estado-prestamo.enum';
import { FiltrosPrestamosElegiblesDto } from '../dto/filtros-prestamos-elegibles.dto';

const money = (value: number) => Math.round(value * 100) / 100;
const clientName = "UPPER(TRIM(CONCAT_WS(' ', cliente.primer_nombre, cliente.segundo_nombre, cliente.primer_apellido, cliente.segundo_apellido)))";
const paid = "(SELECT COALESCE(SUM(pago.monto), 0) FROM pago pago WHERE pago.prestamo_id = prestamo.id AND pago.estado = 'REGISTRADO')";

@Injectable()
export class ListarPrestamosElegiblesUseCase {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async execute(dto: FiltrosPrestamosElegiblesDto) {
    const query = this.dataSource.getRepository(PrestamoOrmEntity)
      .createQueryBuilder('prestamo')
      .leftJoinAndSelect('prestamo.cliente', 'cliente')
      .where('prestamo.estado = :estado', { estado: EstadoPrestamo.ACTIVO })
      // These predicates are the SQL equivalent of calcularElegibilidadRefinanciamiento().
      .andWhere(`${paid} >= prestamo.interes`)
      .andWhere(`prestamo.capital - GREATEST(${paid} - prestamo.interes, 0) > 0`)
      .andWhere('NOT EXISTS (SELECT 1 FROM refinanciamiento r WHERE r.prestamo_origen_id = prestamo.id)');

    const terms = dto.buscar?.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean) ?? [];
    terms.forEach((term, index) => {
      const parameter = `buscarElegible${index}`;
      query.andWhere(`(CAST(prestamo.id AS TEXT) ILIKE :${parameter} OR ${clientName} ILIKE :${parameter} OR cliente.identificacion ILIKE :${parameter} OR cliente.telefono1 ILIKE :${parameter} OR cliente.telefono2 ILIKE :${parameter} OR cliente.direccion ILIKE :${parameter})`, { [parameter]: `%${term}%` });
    });

    query.orderBy('prestamo.id', 'ASC');
    const total = await query.clone().getCount();
    const entities = await query.skip((dto.pagina - 1) * dto.limite).take(dto.limite).getMany();
    if (!entities.length) return { datos: [], pagina: dto.pagina, limite: dto.limite, total, totalPaginas: Math.ceil(total / dto.limite) };

    const ids = entities.map((entity) => entity.id);
    const totals = await this.dataSource.getRepository(PagoOrmEntity).createQueryBuilder('pago')
      .select('pago.prestamo_id', 'prestamo_id').addSelect('SUM(pago.monto)', 'total_pagado')
      .where('pago.prestamo_id IN (:...ids)', { ids }).andWhere("pago.estado = 'REGISTRADO'")
      .groupBy('pago.prestamo_id').getRawMany<{ prestamo_id: string; total_pagado: string }>();
    const paidByLoan = new Map(totals.map((row) => [Number(row.prestamo_id), Number(row.total_pagado ?? 0)]));
    const datos = entities.map((loan) => {
      const totalPaid = money(paidByLoan.get(loan.id) ?? 0);
      const capitalPendiente = money(Math.max(0, loan.capital - Math.max(0, totalPaid - loan.interes)));
      const cliente = loan.cliente as ClienteOrmEntity;
      return { id: loan.id, clienteId: loan.clienteId, cliente: { id: cliente.id, identificacion: cliente.identificacion, nombreCompleto: [cliente.primerNombre, cliente.segundoNombre, cliente.primerApellido, cliente.segundoApellido].filter(Boolean).join(' '), telefono: cliente.telefono1 ?? cliente.telefono2 ?? null, direccion: cliente.direccion ?? null }, estado: loan.estado, capital: loan.capital, interes: loan.interes, montoTotal: loan.montoTotal, capitalPendiente, saldoFinanciero: money(Math.max(0, loan.montoTotal - totalPaid)) };
    });
    return { datos, pagina: dto.pagina, limite: dto.limite, total, totalPaginas: Math.ceil(total / dto.limite) };
  }
}
