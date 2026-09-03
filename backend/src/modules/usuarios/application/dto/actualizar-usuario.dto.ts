import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { RolUsuario } from '../../domain/enums/rol-usuario.enum';

export class ActualizarUsuarioDto {
  @ApiPropertyOptional({ example: '1-2345-6789' }) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @ValidateIf((_, value) => value !== undefined) @IsString() @IsNotEmpty() @MaxLength(30) identificacion?: string;
  @ApiPropertyOptional({ example: 'Juan Pérez' }) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @ValidateIf((_, value) => value !== undefined) @IsString() @IsNotEmpty() @MaxLength(200) nombreCompleto?: string;
  @ApiPropertyOptional({ example: '8888-8888', nullable: true }) @Transform(({ value }) => typeof value === 'string' ? value.trim() || null : value) @IsOptional() @IsString() @MaxLength(30) telefono?: string | null;
  @ApiPropertyOptional({ example: 'juan.perez@example.com', nullable: true }) @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() || null : value) @IsOptional() @IsEmail() @MaxLength(150) correo?: string | null;
  @ApiPropertyOptional({ enum: RolUsuario }) @IsOptional() @IsEnum(RolUsuario) rol?: RolUsuario;
}
