import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CrearClienteDto } from './crear-cliente.dto';
import { Genero } from '../../domain/enums/genero.enum';

export class ActualizarClienteDto extends PartialType(CrearClienteDto) {
  @ApiPropertyOptional({ description: 'Género del cliente', enum: Genero, example: Genero.FEMENINO }) @IsOptional() @IsEnum(Genero) genero?: Genero;
}
