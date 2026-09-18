import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer'; import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
export class PeriodoDto {
  @ApiProperty({ example: 2026, minimum: 2000 }) @Type(() => Number) @IsInt() @Min(2000) anio!: number;
  @ApiProperty({ example: 1, minimum: 1, maximum: 12 }) @Type(() => Number) @IsInt() @Min(1) @Max(12) mes!: number;
  @ApiPropertyOptional({ example: 'Cierre revisado.', nullable: true, maxLength: 1000 }) @IsOptional() @IsString() @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @MaxLength(1000) observaciones?: string | null;
}
