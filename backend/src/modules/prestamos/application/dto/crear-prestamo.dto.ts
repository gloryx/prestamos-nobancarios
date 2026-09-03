import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsPositive, IsString, Matches, MaxLength, Min } from 'class-validator';
import { ArrayNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { CuotaPlanPagoDto } from '../../../planes-pago/application/dto/cuota-plan-pago.dto';

export class CrearPrestamoDto {
  @ApiProperty({ example: 1 }) @Type(() => Number) @IsInt() @IsPositive() clienteId: number;
  @ApiProperty({ example: 2 }) @Type(() => Number) @IsInt() @IsPositive() periodicidadPagoId: number;
  @ApiProperty({ example: 1 }) @Type(() => Number) @IsInt() @IsPositive() formaPagoId: number;
  @ApiProperty({ example: '2026-08-30', format: 'date' }) @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) fechaAlta: string;
  @ApiProperty({ example: 100000 }) @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() capital: number;
  @ApiProperty({ example: 15000 }) @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) interes: number;
  @ApiProperty({ example: 12 }) @Type(() => Number) @IsInt() @IsPositive() cantidadPagos: number;
  @ApiProperty({ example: false }) @IsBoolean() planPersonalizado: boolean;
  @ApiProperty({ type: [CuotaPlanPagoDto], required: false }) @IsOptional() @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => CuotaPlanPagoDto) cuotas?: CuotaPlanPagoDto[];
  @ApiPropertyOptional({ example: 'Préstamo para capital de trabajo.' }) @IsOptional() @IsString() @MaxLength(1000) observaciones?: string;
}
