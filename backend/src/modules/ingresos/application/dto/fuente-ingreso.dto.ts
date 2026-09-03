import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CrearFuenteIngresoDto { @ApiProperty({ example: 'Salario docente', maxLength: 120 }) @IsString() @IsNotEmpty() @Matches(/\S/) @MaxLength(120) nombre: string; }
export class ActualizarFuenteIngresoDto { @ApiProperty({ example: 'Salario docente', maxLength: 120 }) @IsString() @IsNotEmpty() @Matches(/\S/) @MaxLength(120) nombre: string; }
export class CambiarEstadoFuenteIngresoDto { @ApiProperty() @IsBoolean() activo: boolean; }
export class FiltrosFuentesIngresoDto { @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value) @IsBoolean() activo?: boolean; }
