import { ApiProperty } from '@nestjs/swagger';
import { RefinanciamientoResponseDto } from './refinanciamiento-response.dto';
export class RefinanciamientosPaginadosResponseDto { @ApiProperty({ type: [RefinanciamientoResponseDto] }) datos!: RefinanciamientoResponseDto[]; @ApiProperty() pagina!: number; @ApiProperty() limite!: number; @ApiProperty() total!: number; @ApiProperty() totalPaginas!: number; }
