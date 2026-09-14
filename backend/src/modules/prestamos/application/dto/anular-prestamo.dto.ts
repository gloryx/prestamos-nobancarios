import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class AnularPrestamoDto {
  @ApiProperty({ example: '2026-09-14', format: 'date', description: 'Fecha económica de la anulación.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe tener formato YYYY-MM-DD.' })
  @IsDateString({ strict: true }, { message: 'fecha debe ser una fecha calendario válida.' })
  fecha!: string;

  @ApiPropertyOptional({ example: 'Desembolso registrado por error.', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}
