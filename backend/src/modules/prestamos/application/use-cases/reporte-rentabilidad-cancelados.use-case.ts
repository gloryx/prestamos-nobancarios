import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ReporteRentabilidadCanceladosDto } from '../dto/reporte-rentabilidad-cancelados.dto';
import { RENTABILIDAD_CANCELADOS_REPOSITORY, RentabilidadCanceladosRepository } from '../../domain/repositories/rentabilidad-cancelados.repository';
import { calcularRentabilidadCancelados } from './calcular-rentabilidad-cancelados';
import { economicDateOnly } from '../../../../common/economic-date';

@Injectable()
export class ReporteRentabilidadCanceladosUseCase {
  constructor(@Inject(RENTABILIDAD_CANCELADOS_REPOSITORY) private readonly repository: RentabilidadCanceladosRepository) {}

  async execute(dto: ReporteRentabilidadCanceladosDto) {
    const [currentYear, currentMonth] = economicDateOnly().split('-').map(Number);
    if (dto.anio > currentYear || (dto.anio === currentYear && dto.mes > currentMonth)) {
      throw new BadRequestException('No se puede consultar un mes futuro.');
    }
    const result = calcularRentabilidadCancelados(await this.repository.listar(dto.anio, dto.mes));
    return { ...result, anio: dto.anio, mes: dto.mes };
  }
}
