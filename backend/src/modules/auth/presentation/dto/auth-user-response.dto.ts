import { ApiProperty } from '@nestjs/swagger';
import { RolUsuario } from '../../../usuarios/domain/enums/rol-usuario.enum';

export class AuthUserResponseDto {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: '1-2345-6789' }) identificacion: string;
  @ApiProperty({ example: 'JUAN PÉREZ' }) nombreCompleto: string;
  @ApiProperty({ example: '8888-8888', nullable: true }) telefono: string | null;
  @ApiProperty({ example: 'juan.perez@example.com', nullable: true }) correo: string | null;
  @ApiProperty({ enum: RolUsuario, example: RolUsuario.VENDEDOR }) rol: RolUsuario;
  @ApiProperty({ example: '2026-08-30T12:00:00.000Z', format: 'date-time' }) fechaCreacion: Date;
  @ApiProperty({ example: '2026-08-30T12:00:00.000Z', format: 'date-time' }) fechaActualizacion: Date;
  @ApiProperty({ example: true }) activo: boolean;
}
