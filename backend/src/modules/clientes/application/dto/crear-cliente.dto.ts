import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Nacionalidad } from '../../domain/enums/nacionalidad.enum';
import { Genero } from '../../domain/enums/genero.enum';

export class CrearClienteDto {
  @ApiProperty({ example: '1-2345-6789' }) @IsString() @IsNotEmpty() @MaxLength(30) identificacion: string;
  @ApiProperty({ example: 'Juan' }) @IsString() @IsNotEmpty() @MaxLength(100) primerNombre: string;
  @ApiPropertyOptional({ example: 'Carlos' }) @IsOptional() @IsString() @MaxLength(100) segundoNombre?: string;
  @ApiProperty({ example: 'Pérez' }) @IsString() @IsNotEmpty() @MaxLength(100) primerApellido: string;
  @ApiPropertyOptional({ example: 'Gómez' }) @IsOptional() @IsString() @MaxLength(100) segundoApellido?: string;
  @ApiPropertyOptional({ description: 'Género del cliente', enum: Genero, example: Genero.FEMENINO }) @IsOptional() @IsEnum(Genero) genero?: Genero;
  @ApiPropertyOptional({ example: '1985-04-23', format: 'date' }) @IsOptional() @IsDateString() fechaNacimiento?: string;
  @ApiPropertyOptional({ example: 'San José, Costa Rica' }) @IsOptional() @IsString() @MaxLength(500) direccion?: string;
  @ApiPropertyOptional({ example: 'juan.perez@example.com', nullable: true }) @Transform(({ value }) => typeof value === 'string' && value.trim() === '' ? undefined : value) @IsOptional() @IsEmail() @MaxLength(150) correo?: string;
  @ApiProperty({ example: '8888-8888' }) @IsString() @IsNotEmpty() @MaxLength(30) telefono1: string;
  @ApiPropertyOptional({ example: '2222-2222' }) @IsOptional() @IsString() @MaxLength(30) telefono2?: string;
  @ApiPropertyOptional({ description: 'Nacionalidad del cliente', enum: Nacionalidad, example: Nacionalidad.COSTARRICENSE, nullable: true }) @IsOptional() @IsEnum(Nacionalidad) nacionalidad?: Nacionalidad;
  @ApiPropertyOptional({ example: 'Cliente referido.' }) @IsOptional() @IsString() observaciones?: string;
  @ApiPropertyOptional({ description: 'URL o ruta de la fotografía de la identificación del cliente', example: '/uploads/clientes/identificaciones/AnaPerez.jpg', maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500) urlIdentificacion?: string;
}
