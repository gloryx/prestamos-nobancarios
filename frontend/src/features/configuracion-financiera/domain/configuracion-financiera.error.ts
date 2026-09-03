import axios from 'axios'

export function configuracionFinancieraErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    switch (error.response?.status) {
      case 401: return 'Tu sesión expiró. Iniciá sesión nuevamente.'
      case 403: return 'Solo un administrador puede configurar la apertura financiera.'
      case 409: return 'La apertura financiera ya fue realizada.'
      case 404: return 'No se encontró la información financiera solicitada.'
      case 400: {
        const message = error.response?.data?.message
        if (typeof message === 'string') return message
        if (Array.isArray(message) && message.every((item): item is string => typeof item === 'string')) {
          return message.join(' ')
        }
        return 'Verificá los datos ingresados e intentá nuevamente.'
      }
    }
    if (!error.response || error.response.status >= 500) return 'El servicio financiero no está disponible. Intentá nuevamente más tarde.'
  }
  return 'No pudimos cargar la configuración financiera. Intentá nuevamente.'
}
