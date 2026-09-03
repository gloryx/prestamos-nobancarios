import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Inject } from '@nestjs/common';
import { USUARIO_REPOSITORY, UsuarioRepository } from '../usuarios/domain/repositories/usuario.repository';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, @Inject(USUARIO_REPOSITORY) private readonly repository: UsuarioRepository) {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: config.getOrThrow<string>('JWT_SECRET') });
  }

  async validate(payload: { sub?: unknown }) {
    const id = Number(payload.sub);
    if (!Number.isInteger(id) || id < 1) throw new UnauthorizedException();
    const usuario = await this.repository.buscarPorId(id);
    if (!usuario || !usuario.activo) throw new UnauthorizedException();
    return { id: usuario.id, sub: usuario.id, identificacion: usuario.identificacion, nombreCompleto: usuario.nombreCompleto, rol: usuario.rol, activo: usuario.activo };
  }
}
