import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, Matches } from 'class-validator';

export class EstadoPlanQueryDto {
  @ApiPropertyOptional({ example: '2026-08-30', format: 'date', description: 'Fecha de corte estricta YYYY-MM-DD.' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  fecha?: string;
}
