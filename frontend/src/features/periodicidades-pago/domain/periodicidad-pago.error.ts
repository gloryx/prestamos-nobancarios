export class PeriodicidadError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function periodicidadErrorMessage(error: unknown): string {
  if (error instanceof PeriodicidadError) {
    if (error.status === 409) return 'Ya existe una periodicidad con ese nombre.'
    if (error.status === 403) return 'No tenés permisos para administrar periodicidades.'
    if (error.status === 401) return 'Tu sesión expiró. Ingresá nuevamente.'
    if (error.status === 404) return 'La periodicidad solicitada no fue encontrada.'
    if (error.status === 400) return 'El nombre debe ser válido y tener entre 1 y 50 caracteres.'
    if (error.status >= 500 || error.status === 0) return 'El servicio no está disponible. Intentá nuevamente.'
  }
  return 'No se pudo completar la operación.'
}
