import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CambiarPasswordDto {
  @ApiProperty({ example: 'NuevaClaveSegura123!' })
  @IsString() @IsNotEmpty() @MinLength(8) @MaxLength(128)
  password: string;
}
