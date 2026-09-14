import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum OrdenarIncobrablesPor { FECHA_VENCIMIENTO = 'fechaVencimiento', SALDO = 'saldoPendiente', CLIENTE = 'cliente', FECHA_INCOBRABLE = 'fechaIncobrable', ID = 'id' }
export enum DireccionIncobrables { ASC = 'ASC', DESC = 'DESC' }

export class FiltrosIncobrablesDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina = 1;
  @ApiPropertyOptional({ default: 10, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limite = 10;
  @ApiPropertyOptional() @IsOptional() @IsString() buscar?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() direccion?: string;
  @ApiPropertyOptional({ format: 'date' }) @IsOptional() @IsDateString({ strict: true }) fechaReferencia?: string;
  @ApiPropertyOptional({ enum: OrdenarIncobrablesPor }) @IsOptional() @IsEnum(OrdenarIncobrablesPor) ordenarPor?: OrdenarIncobrablesPor;
  @ApiPropertyOptional({ enum: DireccionIncobrables }) @IsOptional() @IsEnum(DireccionIncobrables) direccionOrden?: DireccionIncobrables;
}
