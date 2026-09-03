import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';
import { EstadoPrestamo } from '../../domain/enums/estado-prestamo.enum';
export class FiltrosPrestamosDto {
  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina = 1;
  @ApiPropertyOptional({ example: 10, default: 10, minimum: 1, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limite = 10;
  @ApiPropertyOptional({ example: 'Pérez' }) @IsOptional() @IsString() buscar?: string;
  @ApiPropertyOptional({ enum: EstadoPrestamo, example: EstadoPrestamo.ACTIVO }) @IsOptional() @IsEnum(EstadoPrestamo) estado?: EstadoPrestamo;
  @ApiPropertyOptional({ example: 1 }) @IsOptional() @Type(() => Number) @IsInt() @IsPositive() clienteId?: number;
}
