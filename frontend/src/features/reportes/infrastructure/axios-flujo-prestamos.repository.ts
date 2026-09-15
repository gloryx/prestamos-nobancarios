import { apiClient } from '@/core/api/client'
import type { FlujoPrestamosReport, FlujoPrestamosRepository } from '../domain/flujo-prestamos.types'
export class AxiosFlujoPrestamosRepository implements FlujoPrestamosRepository { async get(desde: string, hasta: string) { return (await apiClient.get<FlujoPrestamosReport>('/reportes/flujo-prestamos', { params: { desde, hasta } })).data } }
