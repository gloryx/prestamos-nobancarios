import type { ActualizarUsuarioInput, CrearUsuarioInput, UsuarioFilters, UsuarioRepository } from '../domain/usuario.types'

export const listUsuarios = (repository: UsuarioRepository, filters: UsuarioFilters) => repository.list(filters)
export const createUsuario = (repository: UsuarioRepository, input: CrearUsuarioInput) => repository.create(input)
export const updateUsuario = (repository: UsuarioRepository, id: number, input: ActualizarUsuarioInput) => repository.update(id, input)
export const changeUsuarioStatus = (repository: UsuarioRepository, id: number, activo: boolean) => repository.changeStatus(id, activo)
