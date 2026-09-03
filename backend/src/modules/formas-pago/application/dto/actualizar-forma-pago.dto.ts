import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ActualizarFormaPagoDto {
  @ApiProperty({
    description: 'Nombre de la forma de pago',
    example: 'Transferencia bancaria',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nombre: string;
}
