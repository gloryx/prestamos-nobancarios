import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDateString, IsDefined, IsInt, IsNumber, IsOptional, IsPositive, IsString, Matches, MaxLength, Min } from 'class-validator';

export class CrearPagoDto {
  @ApiProperty({ example: 10 }) @Type(() => Number) @IsInt() @Min(1) prestamoId: number;
  @ApiProperty({ example: 31, description: 'Cuota contractual a la que se aplica el nuevo pago.' }) @Type(() => Number) @IsInt() @Min(1) planPagoId!: number;
  @ApiProperty({ example: 1 }) @IsDefined() @Type(() => Number) @IsInt() @Min(1) formaPagoId: number;
  @ApiProperty({ example: 24000.00 }) @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() monto: number;
  @ApiProperty({ example: '2026-08-30', format: 'date' }) @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) fecha: string;
  @ApiProperty({ example: 7 }) @IsDefined() @Type(() => Number) @IsInt() @Min(1) cobradorId: number;
  @ApiPropertyOptional({ example: 'Pago de cuota 1.', nullable: true }) @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.trim() || null : value) @IsString() @MaxLength(1000) observaciones?: string | null;
}
