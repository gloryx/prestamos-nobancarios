import { ApiProperty } from '@nestjs/swagger';

export class FormaPagoResponseDto {
  @ApiProperty({ description: 'Identificador de la forma de pago', example: 1 })
  id: number;

  @ApiProperty({ description: 'Nombre de la forma de pago', example: 'Sinpe Móvil' })
  nombre: string;

  @ApiProperty({ description: 'Indica si la forma de pago está activa', example: true })
  activo: boolean;
}
