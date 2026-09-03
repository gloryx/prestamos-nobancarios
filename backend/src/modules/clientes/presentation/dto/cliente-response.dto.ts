import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Nacionalidad } from '../../domain/enums/nacionalidad.enum';
import { Genero } from '../../domain/enums/genero.enum';

export class ClienteResponseDto {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: '1-2345-6789' }) identificacion: string;
  @ApiProperty({ example: 'JUAN' }) primerNombre: string;
  @ApiPropertyOptional({ example: 'CARLOS', nullable: true }) segundoNombre: string | null;
  @ApiProperty({ example: 'PÉREZ' }) primerApellido: string;
  @ApiPropertyOptional({ example: 'GÓMEZ', nullable: true }) segundoApellido: string | null;
  @ApiProperty({ description: 'Género del cliente', enum: Genero, nullable: true, example: Genero.FEMENINO }) genero: Genero | null;
  @ApiPropertyOptional({ example: '1985-04-23', format: 'date', nullable: true }) fechaNacimiento: string | null;
  @ApiPropertyOptional({ example: 'SAN JOSÉ, COSTA RICA', nullable: true }) direccion: string | null;
  @ApiPropertyOptional({ example: 'juan.perez@example.com', nullable: true }) correo: string | null;
  @ApiProperty({ example: '8888-8888' }) telefono1: string;
  @ApiPropertyOptional({ example: '2222-2222', nullable: true }) telefono2: string | null;
  @ApiProperty({ description: 'Nacionalidad del cliente', enum: Nacionalidad, nullable: true, example: Nacionalidad.COSTARRICENSE }) nacionalidad: Nacionalidad | null;
  @ApiPropertyOptional({ example: 'CLIENTE REFERIDO.', nullable: true }) observaciones: string | null;
  @ApiProperty({ example: '2026-08-30T12:00:00.000Z', format: 'date-time' }) fechaIngreso: Date;
  @ApiProperty({ description: 'URL o ruta de la fotografía de la identificación del cliente', example: '/uploads/clientes/identificaciones/AnaPerez.jpg', nullable: true }) urlIdentificacion: string | null;
  @ApiProperty({ example: true }) activo: boolean;
}
