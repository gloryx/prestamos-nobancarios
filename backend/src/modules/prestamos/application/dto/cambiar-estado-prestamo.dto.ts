import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { EstadoPrestamo } from '../../domain/enums/estado-prestamo.enum';
export class CambiarEstadoPrestamoDto {
  @ApiProperty({ enum: EstadoPrestamo, example: EstadoPrestamo.INCOBRABLE }) @IsEnum(EstadoPrestamo) estado: EstadoPrestamo;
  @ApiProperty({ required: false, example: '2026-09-02' }) @IsOptional() @IsDateString() fecha?: string;
  @ApiProperty({ required: false, example: 'Evaluación de cobranza.' }) @IsOptional() @IsString() @MaxLength(500) observacion?: string;
}
