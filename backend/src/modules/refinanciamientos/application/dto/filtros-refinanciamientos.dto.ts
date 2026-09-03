import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsPositive, IsString, Matches, Max, Min } from 'class-validator';
export class FiltrosRefinanciamientosDto {
  @ApiPropertyOptional({ default: 1 }) @Type(() => Number) @IsInt() @Min(1) pagina = 1;
  @ApiPropertyOptional({ default: 10, maximum: 100 }) @Type(() => Number) @IsInt() @IsPositive() @Max(100) limite = 10;
  @ApiPropertyOptional() @IsOptional() @IsString() buscar?: string;
  @ApiPropertyOptional() @Type(() => Number) @IsOptional() @IsInt() @IsPositive() clienteId?: number;
  @ApiPropertyOptional({ format: 'date' }) @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) fechaDesde?: string;
  @ApiPropertyOptional({ format: 'date' }) @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) fechaHasta?: string;
}
