export type Role = 'ADMINISTRADOR' | 'VENDEDOR'

export interface User {
  id: number | string
  identificacion: string
  nombreCompleto: string
  rol: Role
  activo: boolean
}

export interface LoginCredentials { identificacion: string; password: string }
export interface LoginResult { accessToken: string }
