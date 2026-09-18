import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
export class ConfigurarFinanzasDto {
  @ApiProperty({ example: '2026-01-01' }) @IsDateString({ strict: true }) fechaApertura!: string;
  @ApiProperty({ example: 0, description: 'Disponible del negocio inmediatamente antes de las operaciones económicas de la fecha de apertura.' }) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) disponibleInicial!: number;
  @ApiProperty({ example: 100000, nullable: true }) @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) capitalSemillaHistorico!: number | null;
  @ApiProperty({ example: 'Inicio del control financiero.', nullable: true, maxLength: 1000 }) @IsOptional() @IsString() @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @MaxLength(1000) observaciones!: string | null;
}
