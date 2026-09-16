import { ApiProperty } from '@nestjs/swagger';

class EstadisticaClienteDto {
  @ApiProperty() posicion!: number;
  @ApiProperty() clienteId!: number;
  @ApiProperty() cliente!: string;
  @ApiProperty() identificacion!: string;
  @ApiProperty() cantidadPrestamos!: number;
  @ApiProperty() totalPrestado!: number;
  @ApiProperty() gananciaCobrada!: number;
  @ApiProperty({ example: '3 años 2 meses' }) antiguedad!: string;
}

export class EstadisticasClientesResponseDto {
  @ApiProperty({ enum: ['cantidadPrestamos', 'totalPrestado', 'gananciaCobrada'] }) orden!: string;
  @ApiProperty({ enum: ['10', '20', '50', 'todos'] }) top!: string;
  @ApiProperty({ type: [EstadisticaClienteDto] }) datos!: EstadisticaClienteDto[];
}
