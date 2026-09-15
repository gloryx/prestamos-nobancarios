import { ApiProperty } from '@nestjs/swagger';
import { EstadoPrestamo } from '../../../prestamos/domain/enums/estado-prestamo.enum';

export class PrestamoElegibleClienteDto {
  @ApiProperty() id!: number;
  @ApiProperty() identificacion!: string;
  @ApiProperty() nombreCompleto!: string;
  @ApiProperty({ nullable: true }) telefono!: string | null;
  @ApiProperty({ nullable: true }) direccion!: string | null;
}

export class PrestamoElegibleResponseDto {
  @ApiProperty() id!: number;
  @ApiProperty({ type: PrestamoElegibleClienteDto }) cliente!: PrestamoElegibleClienteDto;
  @ApiProperty({ enum: EstadoPrestamo }) estado!: EstadoPrestamo;
  @ApiProperty() capital!: number;
  @ApiProperty() interes!: number;
  @ApiProperty() montoTotal!: number;
  @ApiProperty({ description: 'Capital refinanciable, calculado con pagos REGISTRADO.' }) capitalPendiente!: number;
  @ApiProperty({ description: 'Saldo financiero, calculado con pagos REGISTRADO.' }) saldoFinanciero!: number;
}
