import { ApiProperty } from '@nestjs/swagger';
import { FormaPagoResponseDto } from './forma-pago-response.dto';

export class FormasPagoPaginadosResponseDto {
  @ApiProperty({ type: [FormaPagoResponseDto] }) datos: FormaPagoResponseDto[];
  @ApiProperty() pagina: number;
  @ApiProperty() limite: number;
  @ApiProperty() total: number;
  @ApiProperty() totalPaginas: number;
}
