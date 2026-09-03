import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LoginUseCase } from './application/login.use-case';
import { LoginDto } from './application/dto/login.dto';
import { Public } from './auth.decorators';
import { AuthenticatedRequest } from '../../common/authenticated-user';
import { AuthLoginResponseDto } from './presentation/dto/auth-login-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly login: LoginUseCase) {}
  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login JWT', description: 'Obtiene un access token usando identificación y contraseña.' })
   @ApiResponse({ status: 200, description: 'Token y usuario seguro.', type: AuthLoginResponseDto })
  loginUser(@Body() dto: LoginDto) { return this.login.execute(dto); }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usuario autenticado actual' })
  me(@Req() request: AuthenticatedRequest) { return request.user; }
}
