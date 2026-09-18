import type { ClosingRepository } from '../domain/cierre-mensual.types'

export const previewClosing = (repository: ClosingRepository, anio: number, mes: number) => repository.preview(anio, mes)
export const listClosingSnapshots = (repository: ClosingRepository) => repository.list()
export const getClosingSnapshot = (repository: ClosingRepository, id: number) => repository.getById(id)
export const confirmClosing = (repository: ClosingRepository, input: { anio: number; mes: number; observaciones?: string }) => repository.close(input)
