import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConceptoDetalleCorte, EstadoDocumentalCorte } from '../domain/financial.orm-entities';

export { EstadoDocumentalCorte };

export class DetalleCorteResponseDto {
  @ApiProperty({ enum: ConceptoDetalleCorte, description: 'One of the 22 fixed monthly closing concepts.' }) concepto!: ConceptoDetalleCorte;
  @ApiProperty({ example: 125000.5, description: 'Amount in CRC, represented with the backend monetary transformer.' }) monto!: number;
}

export class CierreMensualPreviewResponseDto {
  @ApiProperty({ example: 2026 }) anio!: number;
  @ApiProperty({ example: 1 }) mes!: number;
  @ApiProperty({ example: '2026-01-01' }) fechaInicio!: string;
  @ApiProperty({ example: '2026-01-31' }) fechaFin!: string;
  @ApiProperty({ enum: EstadoDocumentalCorte, description: 'Derived informational state; preview never persists and never confirms a period.' }) estadoDocumental!: EstadoDocumentalCorte;
  @ApiProperty() puedeConfirmar!: boolean;
  @ApiProperty() canClose!: boolean;
  @ApiProperty({ type: [String] }) errors!: string[];
  @ApiProperty() carteraActiva!: number;
  @ApiProperty() carteraIncobrable!: number;
  @ApiProperty() carteraTotal!: number;
  @ApiProperty() pagosRecibidos!: number;
  @ApiProperty() pagosCapital!: number;
  @ApiProperty() pagosInteres!: number;
  @ApiProperty() disponibleInicial!: number;
  @ApiProperty() disponibleFinal!: number;
  @ApiProperty() cajaEntradas!: number;
  @ApiProperty() cajaSalidas!: number;
  @ApiProperty({ type: [DetalleCorteResponseDto] }) detalles!: DetalleCorteResponseDto[];
}

export class CierreMensualResponseDto {
  @ApiProperty() id!: number;
  @ApiProperty({ example: 2026 }) anio!: number;
  @ApiProperty({ example: 1 }) mes!: number;
  @ApiProperty({ example: '2026-01-01' }) fechaInicio!: string;
  @ApiProperty({ example: '2026-01-31' }) fechaFin!: string;
  @ApiProperty({ format: 'date-time' }) fechaCierre!: Date;
  @ApiProperty() usuarioCierreId!: number;
  @ApiPropertyOptional({ nullable: true }) observaciones!: string | null;
  @ApiProperty({ format: 'date-time' }) fechaCreacion!: Date;
  @ApiProperty({ type: [DetalleCorteResponseDto] }) detalles!: DetalleCorteResponseDto[];
}
