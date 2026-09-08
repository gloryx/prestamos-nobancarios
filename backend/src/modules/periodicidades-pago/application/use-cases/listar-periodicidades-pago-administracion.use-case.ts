import { Inject, Injectable } from '@nestjs/common';
import { FiltrosPeriodicidadesPagoAdministracionDto } from '../dto/filtros-periodicidades-pago-administracion.dto';
import { PERIODICIDAD_PAGO_REPOSITORY, PeriodicidadPagoRepository } from '../../domain/repositories/periodicidad-pago.repository';

@Injectable()
export class ListarPeriodicidadesPagoAdministracionUseCase {
  constructor(@Inject(PERIODICIDAD_PAGO_REPOSITORY) private readonly repository: PeriodicidadPagoRepository) {}
  execute(dto: FiltrosPeriodicidadesPagoAdministracionDto) { return this.repository.listarAdministracion(dto); }
}
