import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProximaCuotaEstadoPlanDto {
  @ApiProperty({ example: 2 }) numeroPago: number;
  @ApiProperty({ example: '2026-09-12', format: 'date' }) fechaVencimiento: string;
  @ApiProperty({ example: 24000 }) montoOriginal: number;
  @ApiProperty({ example: 33000 }) montoRecomendado: number;
}

export class EstadoPlanResponseDto {
  @ApiProperty({ example: 10 }) prestamoId: number;
  @ApiProperty({ example: '2026-09-05', format: 'date' }) fechaAnalisis: string;
  @ApiProperty({ example: 120000 }) montoTotal: number;
  @ApiProperty({ example: 15000 }) totalPagado: number;
  @ApiProperty({ example: 105000 }) saldoPendiente: number;
  @ApiProperty({ example: 24000 }) esperadoAcumulado: number;
  @ApiProperty({ example: 15000 }) pagadoAcumuladoHastaFecha: number;
  @ApiProperty({ example: 9000 }) diferenciaAcumulada: number;
  @ApiProperty({ enum: ['PENDIENTE', 'ADELANTO', 'AL_DIA'], example: 'PENDIENTE' }) situacion: string;
  @ApiPropertyOptional({ type: ProximaCuotaEstadoPlanDto, nullable: true }) proximaCuota: ProximaCuotaEstadoPlanDto | null;
}
