import { ApiProperty } from '@nestjs/swagger';

export class PeriodicidadPagoResponseDto {
  @ApiProperty({ description: 'Identificador de la periodicidad de pago', example: 1 })
  id: number;

  @ApiProperty({ description: 'Nombre de la periodicidad de pago', example: 'Semanal' })
  nombre: string;

  @ApiProperty({ description: 'Indica si la periodicidad se encuentra activa', example: true })
  activo: boolean;
}
