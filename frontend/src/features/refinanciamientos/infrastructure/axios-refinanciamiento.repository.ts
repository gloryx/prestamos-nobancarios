import axios from 'axios'
import { apiClient } from '@/core/api/client'
import type { CrearRefinanciamientoInput, RefinanciamientoListFilters, RefinanciamientoPage, RefinanciamientoPreview, RefinanciamientoReportFilters, RefinanciamientoReportResponse, RefinanciamientoRepository, RefinanciamientoResponse, PrestamosElegiblesPage } from '../domain/refinanciamiento.types'

export class RefinanciamientoRequestError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.name = 'RefinanciamientoRequestError'; this.status = status }
}

function rethrow(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const data: unknown = error.response?.data
    const raw = data && typeof data === 'object' && 'message' in data ? (data as { message?: unknown }).message : undefined
    const message = Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string').join(' ') : typeof raw === 'string' ? raw : 'No se pudo completar la solicitud.'
    throw new RefinanciamientoRequestError(error.response?.status ?? 0, message)
  }
  throw error
}

export class AxiosRefinanciamientoRepository implements RefinanciamientoRepository {
  async listEligible(filters: { pagina: number; limite: number; buscar?: string }): Promise<PrestamosElegiblesPage> {
    try { return (await apiClient.get<PrestamosElegiblesPage>('/refinanciamientos/prestamos-elegibles', { params: filters })).data } catch (error) { return rethrow(error) }
  }
  async list(filters: RefinanciamientoListFilters): Promise<RefinanciamientoPage> {
    try { return (await apiClient.get<RefinanciamientoPage>('/refinanciamientos', { params: filters })).data } catch (error) { return rethrow(error) }
  }
  async report(filters: RefinanciamientoReportFilters): Promise<RefinanciamientoReportResponse> {
    try { return (await apiClient.get<RefinanciamientoReportResponse>('/refinanciamientos/reporte', { params: filters })).data } catch (error) { return rethrow(error) }
  }
  async preview(prestamoId: number): Promise<RefinanciamientoPreview> {
    try { return (await apiClient.get<RefinanciamientoPreview>(`/refinanciamientos/prestamo/${prestamoId}/preview`)).data } catch (error) { return rethrow(error) }
  }
  async create(input: CrearRefinanciamientoInput): Promise<RefinanciamientoResponse> {
    try { return (await apiClient.post<RefinanciamientoResponse>('/refinanciamientos', input)).data } catch (error) { return rethrow(error) }
  }
  async detail(id: number): Promise<RefinanciamientoResponse> {
    try { return (await apiClient.get<RefinanciamientoResponse>(`/refinanciamientos/${id}`)).data } catch (error) { return rethrow(error) }
  }
  async byOriginLoan(id: number): Promise<RefinanciamientoResponse> {
    try { return (await apiClient.get<RefinanciamientoResponse>(`/refinanciamientos/prestamo-origen/${id}`)).data } catch (error) { return rethrow(error) }
  }
  async byNewLoan(id: number): Promise<RefinanciamientoResponse> {
    try { return (await apiClient.get<RefinanciamientoResponse>(`/refinanciamientos/prestamo-nuevo/${id}`)).data } catch (error) { return rethrow(error) }
  }
}
