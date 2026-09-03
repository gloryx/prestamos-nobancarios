import type { ConfiguracionFinancieraRepository, CrearConfiguracionFinanciera } from '../domain/configuracion-financiera.types'

export const obtenerConfiguracionFinanciera = (repository: ConfiguracionFinancieraRepository) => repository.obtener()
export const obtenerVistaPreviaCartera = (repository: ConfiguracionFinancieraRepository, fecha: string) => repository.obtenerVistaPrevia(fecha)
export const crearConfiguracionFinanciera = (repository: ConfiguracionFinancieraRepository, input: CrearConfiguracionFinanciera) => repository.crear(input)
