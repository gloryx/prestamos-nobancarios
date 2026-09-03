import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CrearFormaPagoDto {
  @ApiProperty({
    description: 'Nombre de la forma de pago',
    example: 'Sinpe Móvil',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nombre: string;
}
