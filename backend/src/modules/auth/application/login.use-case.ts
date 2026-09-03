import { Inject, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { timingSafeEqual, scryptSync } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { USUARIO_REPOSITORY, UsuarioRepository } from '../../usuarios/domain/repositories/usuario.repository';
import { normalizeIdentificacion, Usuario } from '../../usuarios/domain/entities/usuario';
import { LoginDto } from './dto/login.dto';
import { AuthLoginResponseDto } from '../presentation/dto/auth-login-response.dto';
import { AuthUserResponseDto } from '../presentation/dto/auth-user-response.dto';

const invalid = () => new UnauthorizedException('Credenciales inválidas.');
// Existing users may still contain scrypt:<salt>:<hex digest>. They remain readable;
// new users and password changes always use bcrypt and are never stored as plaintext.
const verifyLegacyScrypt = (password: string, encoded: string): boolean => {
  const parts = encoded.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  try {
    const expected = Buffer.from(parts[2], 'hex');
    const actual = scryptSync(password, parts[1], expected.length || 64);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch { return false; }
};

export const verifyPassword = async (password: string, encoded: string): Promise<boolean> =>
  encoded.startsWith('$2') ? bcrypt.compare(password, encoded) : verifyLegacyScrypt(password, encoded);

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USUARIO_REPOSITORY) private readonly repository: UsuarioRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async execute(dto: LoginDto): Promise<AuthLoginResponseDto> {
    const usuario = await this.repository.buscarPorIdentificacion(normalizeIdentificacion(dto.identificacion));
    if (!usuario || !(await verifyPassword(dto.password, usuario.passwordHash))) throw invalid();
    if (!usuario.activo) throw new ForbiddenException('El usuario está inactivo.');
    const payload = { sub: usuario.id, identificacion: usuario.identificacion, rol: usuario.rol };
    return {
      accessToken: await this.jwt.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN') ?? '8h',
      usuario: this.safeUser(usuario),
    };
  }

  safeUser(usuario: Usuario): AuthUserResponseDto {
    return {
      id: usuario.id as number,
      identificacion: usuario.identificacion,
      nombreCompleto: usuario.nombreCompleto,
      telefono: usuario.telefono,
      correo: usuario.correo,
      rol: usuario.rol,
      fechaCreacion: usuario.fechaCreacion,
      fechaActualizacion: usuario.fechaActualizacion,
      activo: usuario.activo,
    };
  }
}
