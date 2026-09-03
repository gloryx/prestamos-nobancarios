import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CrearPeriodicidadPagoDto {
  @ApiProperty({ description: 'Nombre de la periodicidad de pago', example: 'Semanal' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nombre: string;
}
