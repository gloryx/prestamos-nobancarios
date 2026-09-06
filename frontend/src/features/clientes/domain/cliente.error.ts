export class ClienteError extends Error {
  readonly status: number
  constructor(status: number, message = 'clientes request failed') { super(message); this.status = status }
}

export function clienteErrorMessage(error: unknown): string {
  if (error instanceof ClienteError) {
    if (error.status === 0) return 'No se pudo conectar con el servicio. Verificá tu conexión e intentá nuevamente.'
    if (error.status === 400) return 'Revisá los datos ingresados: hay campos inválidos o incompletos.'
    if (error.status === 401) return 'Tu sesión expiró. Ingresá nuevamente.'
    if (error.status === 403) return 'No tenés permisos para realizar esta operación.'
    if (error.status === 404) return 'El cliente solicitado no fue encontrado.'
    if (error.status === 409) return 'Ya existe un cliente con esa identificación.'
    if (error.status === 413) return 'La solicitud es demasiado grande.'
    if (error.status === 415) return 'El formato de la solicitud no es compatible.'
    if (error.status >= 500) return 'El servicio no está disponible. Intentá nuevamente.'
  }
  return 'No se pudo completar la operación.'
}
