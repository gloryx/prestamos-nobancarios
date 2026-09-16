import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, Matches } from 'class-validator';

const dateOnly = { message: 'Date must use YYYY-MM-DD.' };

export class CobrosDelDiaQuery {
  @ApiPropertyOptional({ format: 'date', example: '2026-09-15' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, dateOnly)
  @IsDateString({ strict: true }, dateOnly)
  fecha?: string;

  @ApiPropertyOptional({ format: 'date', example: '2026-09-15' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, dateOnly)
  @IsDateString({ strict: true }, dateOnly)
  fechaDesde?: string;

  @ApiPropertyOptional({ format: 'date', example: '2026-09-30' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, dateOnly)
  @IsDateString({ strict: true }, dateOnly)
  fechaHasta?: string;
}
