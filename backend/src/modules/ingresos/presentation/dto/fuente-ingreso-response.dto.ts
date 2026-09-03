import { ApiProperty } from '@nestjs/swagger';
export class FuenteIngresoResponseDto { @ApiProperty() id: number; @ApiProperty() nombre: string; @ApiProperty() activo: boolean; @ApiProperty() fechaCreacion: Date; }
