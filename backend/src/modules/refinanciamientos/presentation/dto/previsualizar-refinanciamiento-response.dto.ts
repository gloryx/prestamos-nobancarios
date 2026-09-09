import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoPrestamo } from '../../../prestamos/domain/enums/estado-prestamo.enum';

class PreviewClienteDto { @ApiProperty() id!: number; @ApiProperty() identificacion!: string; @ApiProperty() nombreCompleto!: string; }
class PreviewPrestamoDto { @ApiProperty() id!: number; @ApiProperty({ enum: EstadoPrestamo }) estado!: EstadoPrestamo; @ApiProperty({ format: 'date' }) fechaAlta!: string; @ApiProperty() capital!: number; @ApiProperty() interes!: number; @ApiProperty() montoTotal!: number; }

export class PrevisualizarRefinanciamientoResponseDto {
  @ApiProperty() elegible!: boolean;
  @ApiPropertyOptional({ nullable: true }) motivo!: string | null;
  @ApiProperty({ type: PreviewClienteDto }) cliente!: PreviewClienteDto;
  @ApiProperty({ type: PreviewPrestamoDto }) prestamo!: PreviewPrestamoDto;
  @ApiProperty() totalPagado!: number;
  @ApiProperty() interesRequerido!: number;
  @ApiProperty() interesPendienteParaRefinanciar!: number;
  @ApiProperty() capitalAmortizadoRefinanciamiento!: number;
  @ApiProperty() capitalPendienteRefinanciable!: number;
}
