import { ApiProperty } from '@nestjs/swagger';
import { PrestamoResponseDto } from './prestamo-response.dto';
export class PrestamosPaginadosResponseDto {
  @ApiProperty({ type: PrestamoResponseDto, isArray: true }) datos: PrestamoResponseDto[];
  @ApiProperty({ example: 1 }) pagina: number; @ApiProperty({ example: 10 }) limite: number; @ApiProperty({ example: 25 }) total: number; @ApiProperty({ example: 3 }) totalPaginas: number;
}
