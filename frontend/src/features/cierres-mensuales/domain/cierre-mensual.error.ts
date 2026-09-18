import axios from 'axios'

export function cierreMensualError(reason: unknown): string {
  if (axios.isAxiosError(reason)) {
    const message = reason.response?.data && typeof reason.response.data === 'object' && 'message' in reason.response.data ? reason.response.data.message : undefined
    if (Array.isArray(message)) return message.join(' ')
    if (typeof message === 'string') return message
    if (reason.response?.status === 401) return 'La sesión expiró. Ingresá nuevamente.'
    if (reason.response?.status === 403) return 'No tiene permisos para consultar o confirmar cierres mensuales.'
    if (reason.response?.status === 404) return 'No se encontró la información solicitada.'
    if (reason.response?.status === 409) return 'El período ya fue cerrado o no puede procesarse por su secuencia financiera.'
  }
  return 'No fue posible comunicarse con el servicio de cierres mensuales. Intentá nuevamente.'
}

export function cierreMensualStatus(reason: unknown): number | undefined {
  return axios.isAxiosError(reason) ? reason.response?.status : undefined
}
