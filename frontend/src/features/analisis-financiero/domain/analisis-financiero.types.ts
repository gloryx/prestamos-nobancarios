export interface AnalisisFinancieroMes {
  mes: number
  nombreMes: string
  prestamos: number
  pagos: number
  diferencia: number
  ganancia: number
}

export interface AnalisisFinancieroTotales {
  prestamos: number
  pagos: number
  diferencia: number
  ganancia: number
}

export interface ResumenMensualAnalisisFinanciero {
  anio: number
  meses: AnalisisFinancieroMes[]
  totales: AnalisisFinancieroTotales
}

export interface AnalisisFinancieroAnio {
  anio: number
  prestamos: number
  pagos: number
  diferencia: number
  ganancia: number
}

export interface ComparativoAnualAnalisisFinanciero {
  desde: number
  hasta: number
  anios: AnalisisFinancieroAnio[]
}

export interface AnalisisFinancieroRepository {
  obtenerResumenMensual(anio: number): Promise<ResumenMensualAnalisisFinanciero>
  obtenerComparativoAnual(desde: number, hasta: number): Promise<ComparativoAnualAnalisisFinanciero>
}
