export class PrestamoError extends Error {
  readonly status: number

  constructor(status: number, message = 'prestamo request failed') {
    super(message)
    this.status = status
  }
}

export function prestamoErrorMessage(error: unknown): string {
  if (error instanceof PrestamoError) {
    if (error.message !== 'prestamo request failed') return error.message
    if (error.status === 0) return 'No se pudo conectar con el servicio. Verificá tu conexión e intentá nuevamente.'
    if (error.status === 400) return 'Revisá los datos ingresados: hay campos inválidos o incompletos.'
    if (error.status === 401) return 'Tu sesión expiró. Ingresá nuevamente.'
    if (error.status === 403) return 'No tenés permisos para realizar esta operación.'
    if (error.status === 404) return 'El préstamo solicitado no fue encontrado.'
    if (error.status === 409) return 'La operación no puede completarse porque existe un conflicto con el estado actual.'
    if (error.status >= 500) return 'El servicio no está disponible. Intentá nuevamente.'
  }
  return 'No se pudo completar la operación.'
}
