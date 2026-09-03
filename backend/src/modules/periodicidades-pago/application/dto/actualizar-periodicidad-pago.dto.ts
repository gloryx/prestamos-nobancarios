import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ActualizarPeriodicidadPagoDto {
  @ApiProperty({ description: 'Nombre de la periodicidad de pago', example: 'Quincenal' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nombre: string;
}
