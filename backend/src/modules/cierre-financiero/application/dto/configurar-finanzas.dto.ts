import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
export class ConfigurarFinanzasDto {
  @ApiProperty({ example: '2026-01-01' }) @IsDateString({ strict: true }) fechaApertura!: string;
  @ApiProperty({ example: 0 }) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) disponibleInicial!: number;
  @ApiProperty({ example: 100000, nullable: true }) @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) capitalSemillaHistorico!: number | null;
  @ApiProperty({ example: 'Inicio del control financiero.', nullable: true }) @IsOptional() @IsString() @MaxLength(1000) observaciones!: string | null;
}
