import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY, ROLES_KEY } from './auth.constants';
import { RolUsuario } from '../usuarios/domain/enums/rol-usuario.enum';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES_KEY, roles);
