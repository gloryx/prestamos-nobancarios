import { Inject, Injectable } from '@nestjs/common';
import { FiltrosPagos, PagoRepository, PAGO_REPOSITORY } from '../../domain/repositories/pago.repository';
import { FiltrosPagosDto } from '../dto/filtros-pagos.dto';

@Injectable()
export class ListarPagosUseCase {
  constructor(@Inject(PAGO_REPOSITORY) private readonly pagos: PagoRepository) {}
  execute(dto: FiltrosPagosDto) { return this.pagos.listar(dto as FiltrosPagos); }
}
