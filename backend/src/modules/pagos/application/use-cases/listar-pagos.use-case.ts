import { Inject, Injectable } from '@nestjs/common';
import { FiltrosPagos, PagoRepository, PAGO_REPOSITORY } from '../../domain/repositories/pago.repository';
import { FiltrosPagosDto } from '../dto/filtros-pagos.dto';
import { BadRequestException } from '@nestjs/common';

@Injectable()
export class ListarPagosUseCase {
  constructor(@Inject(PAGO_REPOSITORY) private readonly pagos: PagoRepository) {}
  execute(dto: FiltrosPagosDto) {
    if (dto.fechaDesde && dto.fechaHasta && dto.fechaDesde > dto.fechaHasta) throw new BadRequestException('fechaDesde no puede ser posterior a fechaHasta.');
    return this.pagos.listar(dto as FiltrosPagos);
  }
}
