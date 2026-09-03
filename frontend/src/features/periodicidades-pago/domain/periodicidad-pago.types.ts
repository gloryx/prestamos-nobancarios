export interface Periodicidad {
  id: number
  nombre: string
  activo: boolean
}

export interface PeriodicidadInput {
  nombre: string
}

export interface PeriodicidadRepository {
  list(): Promise<Periodicidad[]>
  getById(id: number): Promise<Periodicidad>
  create(input: PeriodicidadInput): Promise<Periodicidad>
  update(id: number, input: PeriodicidadInput): Promise<Periodicidad>
  changeStatus(id: number, activo: boolean): Promise<Periodicidad>
}
