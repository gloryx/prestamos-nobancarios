export type AuthErrorKind = 'invalid-credentials' | 'inactive' | 'unavailable' | 'unexpected'

export class AuthError extends Error {
  readonly kind: AuthErrorKind
  constructor(kind: AuthErrorKind) { super(kind); this.kind = kind }
}
