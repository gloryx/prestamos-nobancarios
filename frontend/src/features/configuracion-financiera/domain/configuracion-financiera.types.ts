export type ConfiguracionFinanciera = {
  fechaApertura: string
  carteraInicial: number
  carteraActivaInicial: number
  carteraIncobrableInicial: number
  disponibleInicial: number
  capitalSemillaHistorico: number | null
  observaciones: string | null
}

export type VistaPreviaCartera = {
  fechaApertura: string
  carteraTotal: number
  carteraActiva: number
  carteraIncobrable: number
}

export type CrearConfiguracionFinanciera = {
  fechaApertura: string
  disponibleInicial: number
  capitalSemillaHistorico?: number | null
  observaciones?: string | null
}

export interface ConfiguracionFinancieraRepository {
  obtener(): Promise<ConfiguracionFinanciera | null>
  obtenerVistaPrevia(fecha: string): Promise<VistaPreviaCartera>
  crear(input: CrearConfiguracionFinanciera): Promise<ConfiguracionFinanciera>
}
