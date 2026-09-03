import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { CuotaPlanPagoDto } from './cuota-plan-pago.dto';

export class PlanPagoPersonalizadoDto {
  @ApiProperty({ type: [CuotaPlanPagoDto], example: [{ numeroPago: 1, fechaVencimiento: '2026-09-05', montoProgramado: 24000 }, { numeroPago: 2, fechaVencimiento: '2026-09-12', montoProgramado: 24000 }, { numeroPago: 3, fechaVencimiento: '2026-09-19', montoProgramado: 24000 }, { numeroPago: 4, fechaVencimiento: '2026-09-26', montoProgramado: 24000 }, { numeroPago: 5, fechaVencimiento: '2026-10-03', montoProgramado: 24000 }] })
  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => CuotaPlanPagoDto) cuotas: CuotaPlanPagoDto[];
}
