import { UnauthorizedException } from '@nestjs/common';

export interface AuthenticatedRequest { user?: { id?: unknown; identificacion?: string; nombreCompleto?: string; rol?: string; activo?: boolean } }

export function authenticatedUserId(request: AuthenticatedRequest): number {
  const candidate = request?.user?.id;
  const id = typeof candidate === 'number' ? candidate : Number(candidate);
  if (!Number.isInteger(id) || id < 1) throw new UnauthorizedException('Se requiere una identidad autenticada para operar.');
  return id;
}
