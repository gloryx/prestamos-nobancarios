import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, ValidateIf } from 'class-validator';
import { MotivoAnulacionPago } from '../../domain/enums/motivo-anulacion-pago.enum';
export class AnularPagoDto {
  @ApiProperty({ enum: MotivoAnulacionPago }) @IsEnum(MotivoAnulacionPago) motivo!: MotivoAnulacionPago;
  @ApiPropertyOptional() @ValidateIf((value: AnularPagoDto) => value.motivo === MotivoAnulacionPago.OTRO) @IsString() @IsNotEmpty() observacion?: string;
}
