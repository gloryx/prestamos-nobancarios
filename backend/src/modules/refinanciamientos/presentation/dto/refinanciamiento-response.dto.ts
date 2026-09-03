import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RefinanciamientoResponseDto {
  @ApiProperty() id!: number;
  @ApiProperty() prestamoOrigenId!: number;
  @ApiProperty() prestamoNuevoId!: number;
  @ApiProperty() fecha!: string;
  @ApiProperty() capitalPendiente!: number;
  @ApiProperty() interesPendiente!: number;
  @ApiProperty() montoRefinanciado!: number;
  @ApiProperty() interesNuevo!: number;
  @ApiPropertyOptional() observaciones!: string | null;
  @ApiProperty() fechaCreacion!: Date;
  @ApiProperty() saldoAnterior!: { capitalPendiente: number; interesPendiente: number; montoRefinanciado: number };
  @ApiProperty() nuevaOperacion!: { dineroNuevoDesembolsado: number; interesNuevo: number };
  @ApiProperty() prestamoNuevo!: unknown;
  @ApiProperty() prestamoOrigen!: unknown;
  @ApiProperty() composicion!: { interesAnteriorPendiente: number; interesNuevo: number; interesTotalNuevo: number; capitalAnteriorPendiente: number; dineroNuevoDesembolsado: number; capitalTotalNuevo: number };
  @ApiPropertyOptional() pagosOrigen?: unknown[];
  @ApiPropertyOptional() pagosNuevo?: unknown[];
  @ApiPropertyOptional() planNuevo?: unknown[];
}
