import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsDefined, IsInt, IsNumber, IsOptional, IsPositive, IsString, Matches, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { CuotaPlanPagoDto } from '../../../planes-pago/application/dto/cuota-plan-pago.dto';
export class CrearRefinanciamientoDto {
  @ApiProperty({ example: 10 }) @Type(() => Number) @IsInt() @IsPositive() prestamoOrigenId!: number;
  @ApiProperty({ example: 2 }) @Type(() => Number) @IsInt() @IsPositive() periodicidadPagoId!: number;
  @ApiProperty({ example: 1 }) @Type(() => Number) @IsInt() @IsPositive() formaPagoId!: number;
  @ApiPropertyOptional({ example: 2, nullable: true, description: 'Obligatoria cuando montoNuevoDesembolsado es mayor que cero.' }) @ValidateIf(dto => Number(dto.montoNuevoDesembolsado) > 0) @IsDefined() @Type(() => Number) @IsInt() @IsPositive() formaDesembolsoId?: number | null;
  @ApiProperty({ example: '2026-09-01', format: 'date' }) @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) fecha!: string;
  @ApiProperty({ example: 25000, minimum: 0 }) @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) montoNuevoDesembolsado!: number;
  @ApiProperty({ example: 18000, minimum: 0 }) @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) interesNuevo!: number;
  @ApiProperty({ example: 12 }) @Type(() => Number) @IsInt() @IsPositive() cantidadPagos!: number;
  @ApiProperty({ example: false }) @IsBoolean() planPersonalizado!: boolean;
  @ApiPropertyOptional({ type: [CuotaPlanPagoDto] }) @IsOptional() @ValidateNested({ each: true }) @Type(() => CuotaPlanPagoDto) cuotas?: CuotaPlanPagoDto[];
  @ApiPropertyOptional({ example: 'Refinanciación por ampliación de capital.' }) @IsOptional() @IsString() @MaxLength(1000) observaciones?: string;
}
