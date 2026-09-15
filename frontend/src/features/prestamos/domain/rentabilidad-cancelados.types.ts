export type RentabilidadPorPlazo = {
  plazo: string
  cantidad: number
  capital: number
  ganancia: number
  rentabilidadTotal: number
  tasa30Dias: number
}

export type RentabilidadCanceladosReport = {
  anio: number
  mes: number
  resumen: {
    prestamosCancelados: number
    capitalTotal: number
    gananciaTotal: number
    rentabilidadTotal: number
    tasa30Dias: number
  }
  metadata: {
    registrosConDuracionValida: number
    registrosSinDuracionValida: number
    capitalTemporalValido: number
  }
  porPlazo: RentabilidadPorPlazo[]
}

export interface RentabilidadCanceladosRepository {
  report(anio: number, mes: number): Promise<RentabilidadCanceladosReport>
}
