import { IsString, Matches } from 'class-validator';

export class FlujoPrestamosQueryDto {
  @IsString() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) desde!: string;
  @IsString() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) hasta!: string;
}
