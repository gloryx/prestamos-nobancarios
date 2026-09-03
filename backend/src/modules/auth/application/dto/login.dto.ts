import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: '1-2345-6789' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  identificacion: string;

  @ApiProperty({ example: '<password>' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}
