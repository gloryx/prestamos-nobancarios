export type Genero = 'FEMENINO' | 'MASCULINO'
export type Nacionalidad = 'COSTARRICENSE' | 'NICARAGUENSE' | 'PANAMEÑO' | 'ARABE'

export interface Cliente {
  id: number
  identificacion: string
  primerNombre: string
  segundoNombre: string | null
  primerApellido: string
  segundoApellido: string | null
  genero: Genero | null
  fechaNacimiento: string | null
  direccion: string | null
  correo: string | null
  telefono1: string
  telefono2: string | null
  nacionalidad: Nacionalidad | null
  observaciones: string | null
  urlIdentificacion: string | null
  activo: boolean
  fechaIngreso: string
}

export interface ClientePage { datos: Cliente[]; pagina: number; limite: number; total: number; totalPaginas: number }
export interface ClientesResumen { total: number; masculino: number; femenino: number; conPrestamoActivo: number }
export interface AnalisisFinancieroCliente {
  id: number
  identificacion: string
  nombreCompleto: string
  telefono1: string
  telefono2: string | null
}
export interface AnalisisFinancieroResumen { totalPrestado: number; totalPagado: number; pendiente: number; ganancia: number; cantidadPrestamos: number }
export interface AnalisisFinancieroUltimoPago { fecha: string; monto: number }
export interface AnalisisFinancieroPrestamo {
  id: number; estado: string; fechaAlta: string; capital: number; interes: number; montoTotal: number
  totalPagado: number; capitalPagado: number; interesPagado: number; capitalPendiente: number
  interesPendiente: number; saldoPendiente: number; indicadorCobranza: string
  fechaLimiteContractual: string; ultimoPago: AnalisisFinancieroUltimoPago | null
  duracionDias: number; tipoDuracion: 'FINALIZADO' | 'TRANSCURRIDOS'
}
export interface AnalisisFinancieroResponse { cliente: AnalisisFinancieroCliente; resumen: AnalisisFinancieroResumen; prestamos: AnalisisFinancieroPrestamo[] }
export type ClienteSortField = 'identificacion' | 'nombre' | 'direccion' | 'telefono' | 'estado'
export type ClienteSortDirection = 'ASC' | 'DESC'
export interface ClienteFilters { pagina: number; limite: number; buscar?: string; direccion?: string; activo?: boolean; ordenarPor?: ClienteSortField; direccionOrden?: ClienteSortDirection }
export interface ClienteInput {
  identificacion: string; primerNombre: string; segundoNombre: string | null; primerApellido: string; segundoApellido: string | null; identificacionFile?: File | null
  genero: Genero | null; fechaNacimiento: string | null; direccion: string | null; correo?: string | null; telefono1: string
  telefono2: string | null; nacionalidad: Nacionalidad | null; observaciones: string | null
}
export type CrearClienteInput = ClienteInput
export type ActualizarClienteInput = ClienteInput

export interface ClienteRepository {
  list(filters: ClienteFilters): Promise<ClientePage>
  summary(): Promise<ClientesResumen>
  getById(id: number): Promise<Cliente>
  create(input: CrearClienteInput): Promise<Cliente>
  update(id: number, input: ActualizarClienteInput): Promise<Cliente>
  changeStatus(id: number, activo: boolean): Promise<Cliente>
  getIdentificationImage(id: number): Promise<Blob>
  downloadClientSheet(id: number): Promise<Blob>
  getFinancialAnalysis(id: number): Promise<AnalisisFinancieroResponse>
}
