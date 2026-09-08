import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsPositive, IsString, Matches, Max, Min } from 'class-validator';
import { EstadoPrestamo } from '../../domain/enums/estado-prestamo.enum';
import { INDICADORES_COBRANZA, IndicadorCobranza } from '../services/indicador-cobranza.service';

export enum OrdenarPrestamosPor {
  ID = 'id',
  CLIENTE = 'cliente',
  DIRECCION = 'direccion',
  FECHA_ALTA = 'fechaAlta',
  CAPITAL = 'capital',
  ESTADO = 'estado',
}

export enum DireccionOrden {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class FiltrosPrestamosDto {
  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina = 1;
  @ApiPropertyOptional({ example: 10, default: 10, minimum: 1, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limite = 10;
  @ApiPropertyOptional({ example: 'Pérez' }) @IsOptional() @IsString() buscar?: string;
  @ApiPropertyOptional({ example: 'San José' }) @IsOptional() @IsString() direccion?: string;
  @ApiPropertyOptional({ enum: EstadoPrestamo, isArray: true, example: [EstadoPrestamo.ACTIVO, EstadoPrestamo.CANCELADO] }) @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.split(',').map((estado: string) => estado.trim()).filter(Boolean) : value) @IsArray() @IsEnum(EstadoPrestamo, { each: true }) estados?: EstadoPrestamo[];
  @ApiPropertyOptional({ example: '2026-01-01', format: 'date' }) @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) fechaInicio?: string;
  @ApiPropertyOptional({ example: '2026-12-31', format: 'date' }) @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) fechaFin?: string;
  @ApiPropertyOptional({ enum: EstadoPrestamo, example: EstadoPrestamo.ACTIVO }) @IsOptional() @IsEnum(EstadoPrestamo) estado?: EstadoPrestamo;
  @ApiPropertyOptional({ enum: INDICADORES_COBRANZA }) @IsOptional() @IsIn(INDICADORES_COBRANZA) indicadorCobranza?: IndicadorCobranza;
  @ApiPropertyOptional({ example: 1 }) @IsOptional() @Type(() => Number) @IsInt() @IsPositive() clienteId?: number;
  @ApiPropertyOptional({ enum: OrdenarPrestamosPor }) @IsOptional() @IsEnum(OrdenarPrestamosPor) ordenarPor?: OrdenarPrestamosPor;
  @ApiPropertyOptional({ enum: DireccionOrden }) @IsOptional() @IsEnum(DireccionOrden) direccionOrden?: DireccionOrden;
}
