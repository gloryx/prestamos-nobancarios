import { ApiProperty } from '@nestjs/swagger';
import { PrestamoElegibleResponseDto } from './prestamo-elegible-response.dto';

export class PrestamosElegiblesPaginadosResponseDto {
  @ApiProperty({ type: PrestamoElegibleResponseDto, isArray: true }) datos!: PrestamoElegibleResponseDto[];
  @ApiProperty() pagina!: number;
  @ApiProperty() limite!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPaginas!: number;
}
