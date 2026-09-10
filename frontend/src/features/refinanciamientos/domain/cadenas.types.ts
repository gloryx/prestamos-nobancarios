export interface CadenaCliente {
  id: number
  identificacion: string
  nombreCompleto: string
}

export interface PrestamoCadena {
  id: number
  clienteId: number
  estado: string
  fechaAlta: string
  capital: number
  interes: number
  montoTotal: number
  montoDesembolsado: number
}

export interface TransicionCadena {
  refinanciamientoId: number
  fecha: string
  prestamoOrigenId: number
  prestamoNuevoId: number
  capitalTrasladado: number
  dineroNuevoDesembolsado: number
  interesNuevo: number
  diasGanados: number | null
  fechaLimiteContractualOrigen: string | null
}

export interface CadenaResumen {
  cantidadPrestamos: number
  cantidadRefinanciamientos: number
  capitalInicial: number
  capitalTerminal: number
  totalCapitalTrasladado: number
  totalDineroNuevoDesembolsado: number
  montoRealmenteEntregado: number
  montoRealmenteRecibido: number
  efectivoNetoRecuperado: number
  totalInteresNuevoPactado: number
  diasGanadosAcumulados: number
  diasGanadosCompletos: boolean
  fechaUltimoRefinanciamiento: string
}

export interface Cadena {
  prestamoRaizId: number
  prestamoTerminalId: number
  fechaInicio: string
  resumen: CadenaResumen
  prestamos: PrestamoCadena[]
  transiciones: TransicionCadena[]
}

export interface CadenasClienteResponse {
  cliente: CadenaCliente
  convencionOrdenFechaInicio: string
  resumen: {
    cantidadCadenas: number
    cantidadRefinanciamientos: number
    totalCapitalTrasladado: number
    totalDineroNuevoDesembolsado: number
    montoRealmenteEntregado: number
    montoRealmenteRecibido: number
    efectivoNetoRecuperado: number
    totalInteresNuevoPactado: number
    diasGanadosAcumulados: number
    diasGanadosCompletos: boolean
  }
  cadenas: Cadena[]
}

export interface CadenasRepository {
  listByClient(clientId: number): Promise<CadenasClienteResponse>
}
