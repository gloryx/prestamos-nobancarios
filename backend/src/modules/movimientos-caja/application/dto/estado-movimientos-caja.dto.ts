import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, Matches } from 'class-validator';

export enum OrigenSaldoCaja { APERTURA = 'APERTURA', ULTIMO_CIERRE = 'ULTIMO_CIERRE' }

export class DesgloseEstadoCajaDto {
  @ApiProperty() total!: number;
  @ApiProperty() pagosClientes!: number;
  @ApiProperty() aportesCapital!: number;
  @ApiProperty() ajustes!: number;
  @ApiProperty() desembolsosPrestamos!: number;
  @ApiProperty() desembolsosRefinanciamientos!: number;
  @ApiProperty() retiros!: number;
  @ApiProperty() gastos!: number;
  @ApiProperty() reversos!: number;
  @ApiProperty() otros!: number;
}

export class EstadoMovimientosCajaDto {
  @ApiProperty({ example: '2026-09-16', format: 'date' }) fechaConsulta!: string;
  @ApiProperty({ example: '2026-01-01', format: 'date' }) fechaApertura!: string;
  @ApiProperty({ enum: OrigenSaldoCaja }) origenSaldo!: OrigenSaldoCaja;
  @ApiProperty({ example: '2026-08-31', format: 'date' }) fechaOrigen!: string;
  @ApiProperty({ example: 100000 }) disponibleOrigen!: number;
  @ApiProperty({ type: DesgloseEstadoCajaDto }) entradas!: DesgloseEstadoCajaDto;
  @ApiProperty({ type: DesgloseEstadoCajaDto }) salidas!: DesgloseEstadoCajaDto;
  @ApiProperty({ example: 12500 }) flujoNeto!: number;
  @ApiProperty({ example: 112500 }) disponible!: number;
  @ApiProperty({ example: 8 }) cantidadMovimientos!: number;
}

export class EstadoMovimientosCajaQueryDto {
  @ApiPropertyOptional({ example: '2026-09-16', format: 'date', description: 'Fecha económica inclusiva. Si se omite, se usa la fecha económica del backend.' }) @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true })
  fecha?: string;
}
