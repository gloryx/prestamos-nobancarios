import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoPago } from '../../domain/enums/estado-pago.enum';
import { MotivoAnulacionPago } from '../../domain/enums/motivo-anulacion-pago.enum';

export class PagoResponseDto {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 10 }) prestamoId: number;
  @ApiProperty({ example: 1 }) formaPagoId: number;
  @ApiProperty({ example: 24000 }) monto: number;
  @ApiProperty({ example: 20000 }) capitalAplicado: number;
  @ApiProperty({ example: 4000 }) interesAplicado: number;
  @ApiProperty({ example: 7 }) cobradorId: number;
  @ApiProperty({ example: '2026-08-30', format: 'date' }) fecha: string;
  @ApiProperty({ example: '2026-08-30T12:00:00.000Z' }) fechaCreacion: Date;
  @ApiPropertyOptional({ example: 'Pago de cuota 1.', nullable: true }) observaciones: string | null;
  @ApiPropertyOptional({ example: 31, nullable: true }) planPagoId?: number | null;
  @ApiPropertyOptional({ example: 2, nullable: true }) numeroCuota?: number | null;
  @ApiProperty({ enum: EstadoPago }) estado: EstadoPago;
  @ApiProperty({ example: 'EFECTIVO' }) formaPagoNombre: string;
  @ApiProperty({ example: false }) puedeAnular: boolean;
  @ApiPropertyOptional({ nullable: true, type: 'object', additionalProperties: false, example: { fecha: '2026-08-31', motivo: 'OTRO', observacion: 'Correction' } }) anulacion: { fecha: Date; motivo: MotivoAnulacionPago; observacion: string | null } | null;
  @ApiPropertyOptional({ nullable: true }) fechaAnulacion: Date | null;
  @ApiPropertyOptional({ nullable: true }) usuarioAnulacionId: number | null;
  @ApiPropertyOptional({ enum: MotivoAnulacionPago, nullable: true }) motivoAnulacion: MotivoAnulacionPago | null;
  @ApiPropertyOptional({ nullable: true }) observacionAnulacion: string | null;
  @ApiProperty({ example: { id: 1, nombre: 'EFECTIVO' } }) formaPago: { id: number; nombre: string };
  @ApiProperty({ example: { id: 10, estado: 'ACTIVO', capital: 100000, interes: 15000, montoTotal: 115000 } }) prestamo: { id: number; estado: string; capital: number; interes: number; montoTotal: number };
  @ApiProperty({ example: { id: 1, identificacion: '1-1111-1111', nombreCompleto: 'JUAN PEREZ' } }) cliente: { id: number; identificacion?: string; nombreCompleto?: string };
  @ApiProperty({ example: { id: 7, identificacion: '1-1111-1111', nombreCompleto: 'JUAN PEREZ', telefono: '8888-8888', correo: 'juan@example.com' } }) cobrador: { id: number; identificacion: string; nombreCompleto: string; telefono: string | null; correo: string | null };
}

export class PagosPaginadosResponseDto { @ApiProperty({ type: [PagoResponseDto] }) datos: PagoResponseDto[]; @ApiProperty() pagina: number; @ApiProperty() limite: number; @ApiProperty() total: number; @ApiProperty() totalPaginas: number; }
