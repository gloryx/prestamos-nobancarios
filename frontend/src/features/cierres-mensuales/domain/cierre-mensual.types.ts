export const closingConcepts = [
  'CARTERA_INICIAL', 'CARTERA_ACTIVA_INICIAL', 'CARTERA_INCOBRABLE_INICIAL',
  'CARTERA_ACTIVA_FINAL', 'CARTERA_INCOBRABLE_FINAL', 'CARTERA_TOTAL_FINAL',
  'DISPONIBLE_INICIAL', 'DISPONIBLE_FINAL', 'PAGOS_RECIBIDOS', 'CAPITAL_RECUPERADO',
  'INTERESES_COBRADOS', 'DESEMBOLSOS_PRESTAMOS', 'DESEMBOLSOS_REFINANCIAMIENTOS',
  'MONTO_REFINANCIADO', 'APORTES_CAPITAL', 'RETIROS', 'GASTOS', 'AJUSTES_ENTRADA',
  'AJUSTES_SALIDA', 'ENTRADAS_CAJA', 'SALIDAS_CAJA', 'RESULTADO_MES',
] as const

export type ClosingConcept = typeof closingConcepts[number]
export type ClosingDetail = { concepto: ClosingConcept; monto: number }

export type ClosingPreview = {
  anio: number; mes: number; fechaInicio: string; fechaFin: string
  estadoDocumental: 'PENDIENTE_CONFIRMACION' | 'LISTO_PARA_CONFIRMAR'
  puedeConfirmar: boolean; canClose: boolean; errors: string[]
  carteraActiva: number; carteraIncobrable: number; carteraTotal: number
  pagosRecibidos: number; pagosCapital: number; pagosInteres: number
  disponibleInicial: number; disponibleFinal: number; cajaEntradas: number; cajaSalidas: number
  detalles: ClosingDetail[]
}

export type ClosingSnapshot = {
  id: number; anio: number; mes: number; fechaInicio: string; fechaFin: string
  fechaCierre: string; usuarioCierreId: number; observaciones: string | null
  fechaCreacion: string; detalles: ClosingDetail[]
}

export type ClosingRepository = {
  preview(anio: number, mes: number): Promise<ClosingPreview>
  list(): Promise<ClosingSnapshot[]>
  getById(id: number): Promise<ClosingSnapshot>
  close(input: { anio: number; mes: number; observaciones?: string }): Promise<ClosingSnapshot>
}
