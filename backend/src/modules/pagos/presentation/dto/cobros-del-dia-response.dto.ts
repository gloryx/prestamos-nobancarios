import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CobroProgramadoResponseDto {
  @ApiProperty() planPagoId!: number;
  @ApiProperty() numeroPago!: number;
  @ApiProperty({ format: 'date' }) fecha!: string;
  @ApiProperty() montoProgramado!: number;
  @ApiProperty() saldoPendiente!: number;
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

export class PagoRecibidoResponseDto {
  @ApiProperty() pagoId!: number;
  @ApiProperty({ format: 'date' }) fecha!: string;
  @ApiProperty() monto!: number;
  @ApiProperty({ nullable: true }) planPagoId!: number | null;
  @ApiProperty({ nullable: true }) numeroPago!: number | null;
  @ApiProperty({ format: 'date', nullable: true }) fechaVencimiento!: string | null;
  @ApiProperty() prestamoId!: number;
  @ApiProperty() estadoPrestamo!: string;
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
  @ApiProperty({ type: [CobroProgramadoResponseDto] }) porCobrar!: CobroProgramadoResponseDto[];
  @ApiProperty({ type: [PagoRecibidoResponseDto] }) pagaron!: PagoRecibidoResponseDto[];
  @ApiProperty() totales!: { porCobrar: { cantidad: number; monto: number }; pagaron: { cantidad: number; monto: number } };
}
