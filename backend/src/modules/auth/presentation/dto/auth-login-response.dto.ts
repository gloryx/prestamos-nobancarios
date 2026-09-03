import { ApiProperty } from '@nestjs/swagger';
import { AuthUserResponseDto } from './auth-user-response.dto';

export class AuthLoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'Bearer', enum: ['Bearer'] })
  tokenType: 'Bearer';

  @ApiProperty({ example: '8h', description: 'JWT lifetime configured by JWT_EXPIRES_IN.' })
  expiresIn: string;

  @ApiProperty({ type: AuthUserResponseDto })
  usuario: AuthUserResponseDto;
}
