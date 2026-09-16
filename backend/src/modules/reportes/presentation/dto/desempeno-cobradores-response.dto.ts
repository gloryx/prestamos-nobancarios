import { ApiProperty } from '@nestjs/swagger';

export class DesempenoCobradorDto {
  @ApiProperty({ nullable: true }) cobradorId!: number | null;
  @ApiProperty() cobradorNombre!: string;
  @ApiProperty() cantidadPagos!: number;
  @ApiProperty() montoRecibido!: number;
  @ApiProperty() capitalAplicado!: number;
  @ApiProperty() interesAplicado!: number;
  @ApiProperty() cantidadClientes!: number;
  @ApiProperty() cantidadPrestamos!: number;
  @ApiProperty() promedioPorPago!: number;
  @ApiProperty() participacionMonto!: number;
}

export class DesempenoCobradoresResponseDto {
  @ApiProperty({ format: 'date' }) fechaDesde!: string;
  @ApiProperty({ format: 'date' }) fechaHasta!: string;
  @ApiProperty({ type: () => Object }) totales!: { cantidadPagos: number; totalRecibido: number; capitalAplicado: number; interesAplicado: number; cantidadCobradores: number };
  @ApiProperty({ type: () => [DesempenoCobradorDto] }) cobradores!: DesempenoCobradorDto[];
}
