import { ApiProperty } from '@nestjs/swagger';
import { RefinanciamientoResponseDto } from './refinanciamiento-response.dto';

export class RefinanciamientoListadoResponseDto extends RefinanciamientoResponseDto {
  @ApiProperty()
  cliente!: { id: number; identificacion: string; nombreCompleto: string };
}
