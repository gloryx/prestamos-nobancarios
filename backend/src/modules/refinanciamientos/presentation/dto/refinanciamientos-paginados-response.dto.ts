import { ApiProperty } from '@nestjs/swagger';
import { RefinanciamientoListadoResponseDto } from './refinanciamiento-listado-response.dto';
export class RefinanciamientosPaginadosResponseDto { @ApiProperty({ type: [RefinanciamientoListadoResponseDto] }) datos!: RefinanciamientoListadoResponseDto[]; @ApiProperty() pagina!: number; @ApiProperty() limite!: number; @ApiProperty() total!: number; @ApiProperty() totalPaginas!: number; }
