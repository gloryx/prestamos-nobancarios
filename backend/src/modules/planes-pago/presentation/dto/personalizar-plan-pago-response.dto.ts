import { ApiProperty } from '@nestjs/swagger';

export class PersonalizarPlanPagoCuotaResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() numeroPago: number;
  @ApiProperty({ format: 'date' }) fechaVencimiento: string;
  @ApiProperty() montoProgramado: number;
  @ApiProperty() montoPagado: number;
  @ApiProperty() montoPendiente: number;
  @ApiProperty() estado: string;
  @ApiProperty() protegida: boolean;
  @ApiProperty() editable: boolean;
  @ApiProperty() eliminable: boolean;
}

export class PersonalizarPlanPagoResponseDto {
  @ApiProperty() saldoPendiente: number;
  @ApiProperty() totalPlanOperativoPendiente: number;
  @ApiProperty({ type: [PersonalizarPlanPagoCuotaResponseDto] }) cuotas: PersonalizarPlanPagoCuotaResponseDto[];
}
