import { ApiProperty } from '@nestjs/swagger';
import { PeriodicidadPagoResponseDto } from './periodicidad-pago-response.dto';

export class PeriodicidadesPagoPaginadosResponseDto {
  @ApiProperty({ type: [PeriodicidadPagoResponseDto] }) datos: PeriodicidadPagoResponseDto[];
  @ApiProperty() pagina: number;
  @ApiProperty() limite: number;
  @ApiProperty() total: number;
  @ApiProperty() totalPaginas: number;
}
