import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { RolUsuario } from '../../domain/enums/rol-usuario.enum';

export class CrearUsuarioDto {
  @ApiProperty({ example: '1-2345-6789' }) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @IsNotEmpty() @MaxLength(30) identificacion: string;
  @ApiProperty({ example: 'Juan Pérez' }) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) @IsString() @IsNotEmpty() @MaxLength(200) nombreCompleto: string;
  @ApiPropertyOptional({ example: '8888-8888', nullable: true }) @Transform(({ value }) => typeof value === 'string' ? value.trim() || null : value) @IsOptional() @IsString() @MaxLength(30) telefono?: string | null;
  @ApiPropertyOptional({ example: 'juan.perez@example.com', nullable: true }) @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() || null : value) @IsOptional() @IsEmail() @MaxLength(150) correo?: string | null;
  @ApiProperty({ enum: RolUsuario, example: RolUsuario.VENDEDOR }) @IsEnum(RolUsuario) rol: RolUsuario;
  @ApiProperty({ example: 'UnaClaveSegura123!' }) @IsString() @IsNotEmpty() @MinLength(8) @MaxLength(200) password: string;
}
