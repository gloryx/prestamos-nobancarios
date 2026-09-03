import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { RolUsuario } from '../../domain/enums/rol-usuario.enum';
const booleanQuery = ({ value }: { value: unknown }) => value === 'true' ? true : value === 'false' ? false : value;
const trimmedQuery = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
export class FiltrosUsuariosDto {
  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina = 1;
  @ApiPropertyOptional({ example: 10, default: 10, minimum: 1, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limite = 10;
  @ApiPropertyOptional({ example: 'perez' }) @IsOptional() @Transform(trimmedQuery) @IsString() buscar?: string;
  @ApiPropertyOptional({ example: true }) @IsOptional() @Transform(booleanQuery) @IsBoolean() activo?: boolean;
  @ApiPropertyOptional({ enum: RolUsuario }) @IsOptional() @IsEnum(RolUsuario) rol?: RolUsuario;
}
