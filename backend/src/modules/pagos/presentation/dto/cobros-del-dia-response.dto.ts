import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CobroDelDiaResponseDto {
  @ApiProperty() planPagoId!: number;
  @ApiProperty() numeroPago!: number;
  @ApiProperty({ format: 'date' }) fecha!: string;
  @ApiProperty() montoProgramado!: number;
  @ApiProperty() montoPagado!: number;
  @ApiProperty({ enum: ['PAGADO', 'PENDIENTE'] }) estado!: string;
  @ApiProperty() prestamoId!: number;
  @ApiProperty() capital!: number;
  @ApiProperty() saldoActual!: number;
  @ApiProperty() estadoPrestamo!: string;
  @ApiProperty() periodicidad!: string;
  @ApiProperty() clienteId!: number;
  @ApiProperty() nombreCompleto!: string;
  @ApiProperty() identificacion!: string;
  @ApiProperty() telefonoPrincipal!: string;
  @ApiProperty({ nullable: true }) direccion!: string | null;
  @ApiProperty() formaPagoId!: number;
  @ApiProperty() formaPagoNombre!: string;
  @ApiPropertyOptional({ nullable: true }) cobradorId!: number | null;
  @ApiPropertyOptional({ nullable: true }) cobradorNombre!: string | null;
}

export class CobrosDelDiaResponseDto {
  @ApiProperty({ nullable: true }) fecha!: string | null;
  @ApiProperty({ nullable: true }) fechaDesde!: string | null;
  @ApiProperty({ nullable: true }) fechaHasta!: string | null;
  @ApiProperty({ type: [CobroDelDiaResponseDto] }) filas!: CobroDelDiaResponseDto[];
  @ApiProperty() totales!: { cantidadProgramados: number; cantidadPagados: number; cantidadPendientes: number; montoProgramado: number; montoRecibido: number };
}
