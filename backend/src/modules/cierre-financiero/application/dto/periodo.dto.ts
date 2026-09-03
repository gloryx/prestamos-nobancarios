import { Type } from 'class-transformer'; import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
export class PeriodoDto { @Type(() => Number) @IsInt() @Min(2000) anio!: number; @Type(() => Number) @IsInt() @Min(1) @Max(12) mes!: number; @IsOptional() @IsString() observaciones?: string | null; }
