import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Matches, IsPositive } from 'class-validator';

export class FiltrosRefinanciamientosReporteDto {
  @ApiPropertyOptional({ description: 'Busca por IDs de préstamos y por identificación, primer nombre o primer apellido de clientes.' })
  @IsOptional() @IsString() buscar?: string;

  @ApiPropertyOptional({ type: Number })
  @Type(() => Number) @IsOptional() @IsInt() @IsPositive() clienteId?: number;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) fechaDesde?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) fechaHasta?: string;
}
