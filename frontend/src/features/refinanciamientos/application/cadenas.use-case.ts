import type { CadenasClienteResponse, CadenasRepository } from '../domain/cadenas.types'

export const listarCadenasPorCliente = (repository: CadenasRepository, clientId: number): Promise<CadenasClienteResponse> => repository.listByClient(clientId)
