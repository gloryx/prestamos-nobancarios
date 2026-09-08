import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsPositive, Matches } from 'class-validator';

export class AjustarCuotaPlanPagoDto {
  @ApiPropertyOptional({ example: 20000.0, description: 'Nuevo monto programado, positivo y con hasta dos decimales.' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'montoProgramado debe ser un número con hasta dos decimales.' })
  @IsPositive({ message: 'montoProgramado debe ser positivo.' })
  montoProgramado!: number;

  @ApiPropertyOptional({ example: '2026-09-12', format: 'date', description: 'Fecha operativa de vencimiento de la cuota.' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fechaVencimiento debe tener formato YYYY-MM-DD.' })
  @IsDateString({ strict: true }, { message: 'fechaVencimiento debe ser una fecha válida.' })
  fechaVencimiento?: string;
}
