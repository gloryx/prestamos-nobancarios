import { ApiProperty } from '@nestjs/swagger';

export class CarteraActivaResponseDto {
  @ApiProperty({ example: 125000, description: 'Pending capital for ACTIVO loans only.' })
  capitalPendiente!: number;
}
