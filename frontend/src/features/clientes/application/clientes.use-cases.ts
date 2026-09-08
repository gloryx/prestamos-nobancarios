import type { ActualizarClienteInput, ClienteFilters, ClienteRepository, CrearClienteInput } from '../domain/cliente.types'

export const listarClientes = (repository: ClienteRepository, filters: ClienteFilters) => repository.list(filters)
export const resumirClientes = (repository: ClienteRepository) => repository.summary()
export const obtenerCliente = (repository: ClienteRepository, id: number) => repository.getById(id)
export const crearCliente = (repository: ClienteRepository, input: CrearClienteInput) => repository.create(input)
export const actualizarCliente = (repository: ClienteRepository, id: number, input: ActualizarClienteInput) => repository.update(id, input)
export const cambiarEstadoCliente = (repository: ClienteRepository, id: number, activo: boolean) => repository.changeStatus(id, activo)
export const obtenerAnalisisFinanciero = (repository: ClienteRepository, id: number) => repository.getFinancialAnalysis(id)
