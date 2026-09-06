import { ApiProperty } from '@nestjs/swagger';

export class PlanPagoResponseDto {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 10 }) prestamoId: number;
  @ApiProperty({ example: 1 }) numeroPago: number;
  @ApiProperty({ example: '2026-09-05', format: 'date' }) fechaVencimiento: string;
  @ApiProperty({ example: 24000.00 }) montoProgramado: number;
  @ApiProperty({ example: '2026-08-30T12:00:00.000Z' }) fechaCreacion: Date;
  @ApiProperty({ example: 12000 }) montoPagado: number;
  @ApiProperty({ example: 12000 }) montoPendiente: number;
  @ApiProperty({ enum: ['PENDIENTE', 'PARCIAL', 'PAGADA'] }) estado: 'PENDIENTE' | 'PARCIAL' | 'PAGADA';
  @ApiProperty({ example: ['2026-09-05'], type: [String] }) fechasPago: string[];
}
