import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive } from 'class-validator';

export class AjustarCuotaPlanPagoDto {
  @ApiProperty({ example: 20000.0, description: 'Nuevo monto programado, positivo y con hasta dos decimales.' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'montoProgramado debe ser un número con hasta dos decimales.' })
  @IsPositive({ message: 'montoProgramado debe ser positivo.' })
  montoProgramado!: number;
}
