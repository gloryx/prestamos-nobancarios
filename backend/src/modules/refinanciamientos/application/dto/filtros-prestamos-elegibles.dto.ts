import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class FiltrosPrestamosElegiblesDto {
  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  pagina = 1;

  @ApiPropertyOptional({ example: 10, default: 10, minimum: 1, maximum: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limite = 10;

  @ApiPropertyOptional({ example: '1-2345-6789' })
  @IsOptional() @IsString()
  buscar?: string;
}
