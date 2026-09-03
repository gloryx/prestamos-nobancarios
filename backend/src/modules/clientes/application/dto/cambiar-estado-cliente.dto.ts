import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class CambiarEstadoClienteDto {
  @ApiProperty({ example: false }) @IsBoolean() activo: boolean;
}
