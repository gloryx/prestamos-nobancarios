import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNumber, IsPositive, Matches } from 'class-validator';

export class CuotaPlanPagoDto {
  @ApiProperty({ example: 1 }) @Type(() => Number) @IsInt() @IsPositive() numeroPago: number;
  @ApiProperty({ example: '2026-09-05', format: 'date' }) @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) fechaVencimiento: string;
  @ApiProperty({ example: 24000.00 }) @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() montoProgramado: number;
}
