import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class ProyeccionQueryDto {
  @IsOptional()
  @IsIn(['15d', '1m', '2m', '3m', 'cartera'])
  periodo = '1m';
}

export class AnalisisFinancieroAnioQueryDto {
  @IsString()
  @Matches(/^\d{4}$/)
  anio!: string;
}

export class AnalisisFinancieroComparativoQueryDto {
  @IsString()
  @Matches(/^\d{4}$/)
  desde!: string;

  @IsString()
  @Matches(/^\d{4}$/)
  hasta!: string;
}
