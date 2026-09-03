import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class CambiarEstadoPeriodicidadPagoDto {
  @ApiProperty({ description: 'Indica si la periodicidad de pago debe estar activa', example: false })
  @IsBoolean()
  activo: boolean;
}
