import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoPrestamo } from '../../domain/enums/estado-prestamo.enum';

export class PrestamoClienteResumenDto { @ApiProperty({ example: 1 }) id: number; @ApiProperty({ example: '1-2345-6789' }) identificacion: string; @ApiProperty({ example: 'ANA MARÍA PÉREZ MORA' }) nombreCompleto: string; @ApiPropertyOptional({ example: 'SAN JOSÉ, COSTA RICA', nullable: true }) direccion: string | null; }
export class PrestamoCatalogoResumenDto { @ApiProperty({ example: 1 }) id: number; @ApiProperty({ example: 'MENSUAL' }) nombre: string; }
export class PrestamoResponseDto {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 1 }) clienteId: number;
  @ApiProperty({ type: PrestamoClienteResumenDto }) cliente: PrestamoClienteResumenDto;
  @ApiProperty({ example: 2 }) periodicidadPagoId: number;
  @ApiProperty({ type: PrestamoCatalogoResumenDto }) periodicidadPago: PrestamoCatalogoResumenDto;
  @ApiProperty({ example: 1 }) formaPagoId: number;
  @ApiProperty({ type: PrestamoCatalogoResumenDto }) formaPago: PrestamoCatalogoResumenDto;
  @ApiPropertyOptional({ example: 2, nullable: true }) formaDesembolsoId: number | null;
  @ApiPropertyOptional({ type: PrestamoCatalogoResumenDto, nullable: true }) formaDesembolso: PrestamoCatalogoResumenDto | null;
  @ApiProperty({ example: '2026-08-30', format: 'date' }) fechaAlta: string;
  @ApiProperty({ example: 100000 }) capital: number;
  @ApiPropertyOptional({ example: 75000 }) capitalPendiente?: number;
  @ApiProperty({ example: 15000 }) interes: number;
  @ApiProperty({ example: 115000 }) montoTotal: number;
  @ApiProperty({ example: 100000 }) montoDesembolsado: number;
  @ApiProperty({ example: 12 }) cantidadPagos: number;
  @ApiProperty({ example: '2027-08-30', format: 'date', required: false }) fechaLimiteContractual?: string;
  @ApiProperty({ enum: ['AL_DIA', 'ATRASADO', 'PLAZO_CUMPLIDO', 'SALDADO'], example: 'AL_DIA', required: false }) indicadorCobranza?: string;
  @ApiProperty({ example: false }) planPersonalizado: boolean;
  @ApiProperty({ enum: EstadoPrestamo, example: EstadoPrestamo.ACTIVO }) estado: EstadoPrestamo;
  @ApiPropertyOptional({ example: 'Préstamo para capital de trabajo.', nullable: true }) observaciones: string | null;
  @ApiProperty({ example: '2026-08-30T12:00:00.000Z', format: 'date-time' }) fechaCreacion: Date;
  @ApiProperty({ example: '2026-08-30T12:00:00.000Z', format: 'date-time' }) fechaActualizacion: Date;
}
