import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
export class CambiarEstadoUsuarioDto { @ApiProperty({ example: false }) @IsBoolean() activo: boolean; }
