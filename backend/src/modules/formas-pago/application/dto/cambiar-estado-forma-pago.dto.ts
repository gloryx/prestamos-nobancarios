import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CambiarEstadoFormaPagoDto {
  @ApiProperty({
    description: 'Indica si la forma de pago debe estar activa; true también es válido.',
    example: false,
  })
  @IsBoolean()
  activo: boolean;
}
