export interface Periodicidad {
  id: number
  nombre: string
  activo: boolean
}

export interface PeriodicidadInput {
  nombre: string
}

export interface PeriodicidadesPaginadas {
  datos: Periodicidad[]
  pagina: number
  limite: number
  total: number
  totalPaginas: number
}

export interface PeriodicidadRepository {
  list(): Promise<Periodicidad[]>
  listAdministration(pagina: number, limite: number): Promise<PeriodicidadesPaginadas>
  getById(id: number): Promise<Periodicidad>
  create(input: PeriodicidadInput): Promise<Periodicidad>
  update(id: number, input: PeriodicidadInput): Promise<Periodicidad>
  changeStatus(id: number, activo: boolean): Promise<Periodicidad>
}
