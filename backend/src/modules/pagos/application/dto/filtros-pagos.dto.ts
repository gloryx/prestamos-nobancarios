import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { EstadoPago } from '../../domain/enums/estado-pago.enum';

export class FiltrosPagosDto {
  @ApiPropertyOptional({ example: 1, default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina = 1;
  @ApiPropertyOptional({ example: 10, default: 10, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limite = 10;
  @ApiPropertyOptional({ example: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) formaPagoId?: number;
  @ApiPropertyOptional({ example: 7 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) cobradorId?: number;
  @ApiPropertyOptional({ example: '2026-09-01', description: 'Inclusive payment date (pago.fecha), in YYYY-MM-DD.' }) @IsOptional() @IsDateString({ strict: true }) fechaDesde?: string;
  @ApiPropertyOptional({ example: '2026-09-30', description: 'Inclusive payment date (pago.fecha), in YYYY-MM-DD.' }) @IsOptional() @IsDateString({ strict: true }) fechaHasta?: string;
  @ApiPropertyOptional({ example: 'Juan 8888', description: 'Trimmed, case-insensitive search over full name, identification, both phones, or loan id.' }) @IsOptional() @IsString() buscar?: string;
  @ApiPropertyOptional({ example: 10 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) prestamoId?: number;
  @ApiPropertyOptional({ enum: ['REGISTRADO', 'ANULADO', 'TODOS'], default: 'REGISTRADO', description: 'Table status filter. Omitting it means REGISTRADO. Totals always use REGISTRADO.' }) @IsOptional() @IsEnum(['REGISTRADO', 'ANULADO', 'TODOS']) estado: EstadoPago | 'TODOS' = EstadoPago.REGISTRADO;
}
