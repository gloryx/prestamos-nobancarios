import { ApiProperty } from '@nestjs/swagger';

class RentabilidadCanceladosResumenDto {
  @ApiProperty({ example: 12, description: 'Cantidad de eventos históricos de transición a CANCELADO ocurridos en el mes consultado.' }) prestamosCancelados!: number;
  @ApiProperty({ example: 1800000, description: 'Suma de prestamo.capital de la población reportada.' }) capitalTotal!: number;
  @ApiProperty({ example: 360000, description: 'Ganancia histórica por evento: SUM(pago.interesAplicado) de pagos vigentes en la fecha de cancelación.' }) gananciaTotal!: number;
  @ApiProperty({ example: 20, description: 'Rentabilidad realizada total: gananciaTotal / capitalTotal × 100.' }) rentabilidadTotal!: number;
  @ApiProperty({ example: 13.33, description: 'Tasa REAL equivalente a 30 días, ponderada por capital entre registros con duración válida: SUM(capital × tasaIndividual30) / SUM(capital), donde tasaIndividual30 = ganancia / capital × 30 / duración × 100.' }) tasa30Dias!: number;
}

class RentabilidadCanceladosMetadataDto {
  @ApiProperty({ example: 11 }) registrosConDuracionValida!: number;
  @ApiProperty({ example: 1, description: 'Registros con duración menor o igual a cero o fechas no válidas; se excluyen únicamente de las métricas temporales.' }) registrosSinDuracionValida!: number;
  @ApiProperty({ example: 1650000, description: 'Capital de los registros incluidos en las métricas temporales.' }) capitalTemporalValido!: number;
}

class RentabilidadCanceladosPorPlazoDto {
  @ApiProperty({ example: '31–45 días' }) plazo!: string;
  @ApiProperty({ example: 4 }) cantidad!: number;
  @ApiProperty({ example: 600000 }) capital!: number;
  @ApiProperty({ example: 120000 }) ganancia!: number;
  @ApiProperty({ example: 20, description: 'Ganancia del grupo / capital del grupo × 100.' }) rentabilidadTotal!: number;
  @ApiProperty({ example: 13.33, description: 'Tasa REAL equivalente a 30 días del grupo, ponderada por capital.' }) tasa30Dias!: number;
}

export class RentabilidadCanceladosResponseDto {
  @ApiProperty({ example: 2026 }) anio!: number;
  @ApiProperty({ example: 9 }) mes!: number;
  @ApiProperty({ type: RentabilidadCanceladosResumenDto }) resumen!: RentabilidadCanceladosResumenDto;
  @ApiProperty({ type: RentabilidadCanceladosMetadataDto }) metadata!: RentabilidadCanceladosMetadataDto;
  @ApiProperty({ type: [RentabilidadCanceladosPorPlazoDto] }) porPlazo!: RentabilidadCanceladosPorPlazoDto[];
}
