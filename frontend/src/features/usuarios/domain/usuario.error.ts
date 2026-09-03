export class UsuarioError extends Error {
  readonly status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

export function usuarioErrorMessage(error: unknown): string {
  if (error instanceof UsuarioError) {
    if (error.status === 409) return 'Ya existe un usuario con esa identificación.'
    if (error.status === 403) return 'No tenés permisos para administrar usuarios.'
    if (error.status === 401) return 'Tu sesión expiró. Ingresá nuevamente.'
    if (error.status === 404) return 'El usuario solicitado no fue encontrado.'
    if (error.status === 400) return 'Los datos enviados no son válidos.'
    if (error.status >= 500) return 'El servicio no está disponible. Intentá nuevamente.'
  }
  return 'No se pudo completar la operación.'
}
