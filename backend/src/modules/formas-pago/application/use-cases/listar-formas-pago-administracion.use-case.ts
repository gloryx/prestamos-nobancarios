import { Inject, Injectable } from '@nestjs/common';
import { FiltrosFormasPagoAdministracionDto } from '../dto/filtros-formas-pago-administracion.dto';
import { FORMA_PAGO_REPOSITORY, FormaPagoRepository } from '../../domain/repositories/forma-pago.repository';

@Injectable()
export class ListarFormasPagoAdministracionUseCase {
  constructor(@Inject(FORMA_PAGO_REPOSITORY) private readonly repository: FormaPagoRepository) {}
  execute(dto: FiltrosFormasPagoAdministracionDto) { return this.repository.listarAdministracion(dto); }
}
