import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class ReporteRentabilidadCanceladosDto {
  @ApiProperty({ example: 2026, description: 'Año del mes económico a consultar.' })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  anio!: number;

  @ApiProperty({ example: 9, description: 'Mes económico a consultar, de 1 a 12.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes!: number;
}
