import { ApiProperty } from '@nestjs/swagger';
import { ClienteResponseDto } from './cliente-response.dto';

export class ClientesPaginadosResponseDto {
  @ApiProperty({ type: ClienteResponseDto, isArray: true }) datos: ClienteResponseDto[];
  @ApiProperty({ example: 1 }) pagina: number;
  @ApiProperty({ example: 10 }) limite: number;
  @ApiProperty({ example: 25 }) total: number;
  @ApiProperty({ example: 3 }) totalPaginas: number;
}
