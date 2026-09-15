import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ReporteRentabilidadCanceladosDto } from '../dto/reporte-rentabilidad-cancelados.dto';
import { RENTABILIDAD_CANCELADOS_REPOSITORY, RentabilidadCanceladosRepository } from '../../domain/repositories/rentabilidad-cancelados.repository';
import { calcularRentabilidadCancelados } from './calcular-rentabilidad-cancelados';

@Injectable()
export class ReporteRentabilidadCanceladosUseCase {
  constructor(@Inject(RENTABILIDAD_CANCELADOS_REPOSITORY) private readonly repository: RentabilidadCanceladosRepository) {}

  async execute(dto: ReporteRentabilidadCanceladosDto) {
    const now = new Date();
    if (dto.anio > now.getUTCFullYear() || (dto.anio === now.getUTCFullYear() && dto.mes > now.getUTCMonth() + 1)) {
      throw new BadRequestException('No se puede consultar un mes futuro.');
    }
    const result = calcularRentabilidadCancelados(await this.repository.listar(dto.anio, dto.mes));
    return { ...result, anio: dto.anio, mes: dto.mes };
  }
}
