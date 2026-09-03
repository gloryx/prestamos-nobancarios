import type { PeriodicidadInput, PeriodicidadRepository } from '../domain/periodicidad-pago.types'

export const listPeriodicidades = (repository: PeriodicidadRepository) => repository.list()
export const getPeriodicidad = (repository: PeriodicidadRepository, id: number) => repository.getById(id)
export const createPeriodicidad = (repository: PeriodicidadRepository, input: PeriodicidadInput) => repository.create(input)
export const updatePeriodicidad = (repository: PeriodicidadRepository, id: number, input: PeriodicidadInput) => repository.update(id, input)
export const changePeriodicidadStatus = (repository: PeriodicidadRepository, id: number, activo: boolean) => repository.changeStatus(id, activo)
