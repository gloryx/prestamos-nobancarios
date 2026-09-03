import { ApiProperty } from '@nestjs/swagger';
import { UsuarioResponseDto } from './usuario-response.dto';
export class UsuariosPaginadosResponseDto { @ApiProperty({ type: [UsuarioResponseDto] }) datos: UsuarioResponseDto[]; @ApiProperty() pagina: number; @ApiProperty() limite: number; @ApiProperty() total: number; @ApiProperty() totalPaginas: number; }
