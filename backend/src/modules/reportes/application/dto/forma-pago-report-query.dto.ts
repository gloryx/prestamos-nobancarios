import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, Matches } from 'class-validator';

export class FormaPagoReportQueryDto {
  @ApiProperty({ example: '2026-01-01', format: 'date' })
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  fechaDesde!: string;

  @ApiProperty({ example: '2026-01-31', format: 'date' })
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  fechaHasta!: string;
}
