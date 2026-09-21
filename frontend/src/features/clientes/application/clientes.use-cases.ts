import type { ActualizarClienteInput, Cliente, ClienteFilters, ClienteRepository, CrearClienteInput } from '../domain/cliente.types'

export const listarClientes = (repository: ClienteRepository, filters: ClienteFilters) => repository.list(filters)

const EXPORT_PAGE_LIMIT = 100

const isClientePage = (value: unknown): value is { datos: Cliente[]; pagina: number; limite: number; total: number; totalPaginas: number } => {
  if (!value || typeof value !== 'object') return false
  const page = value as Record<string, unknown>
  return Array.isArray(page.datos)
    && page.datos.every((cliente) => cliente && typeof cliente === 'object' && Number.isInteger((cliente as Cliente).id))
    && Number.isInteger(page.pagina) && Number.isInteger(page.limite)
    && Number.isInteger(page.total) && Number.isInteger(page.totalPaginas)
    && (page.pagina as number) >= 1 && (page.limite as number) >= 1
    && (page.total as number) >= 0 && (page.totalPaginas as number) >= 0
}

export const obtenerTodosLosClientes = async (repository: ClienteRepository): Promise<Cliente[]> => {
  const clientes: Cliente[] = []
  const ids = new Set<number>()
  const pagesVisited = new Set<number>()
  let pagina = 1
  let totalPaginas: number | null = null
  let totalClientes: number | null = null

  while (totalPaginas === null || pagina <= totalPaginas) {
    if (pagesVisited.has(pagina)) throw new Error('La paginación de clientes entró en un ciclo.')
    pagesVisited.add(pagina)
    const response = await repository.list({ pagina, limite: EXPORT_PAGE_LIMIT, ordenarPor: 'nombre', direccionOrden: 'ASC' })
    if (!isClientePage(response)) throw new Error('La respuesta de clientes no tiene un formato válido.')
    if (response.pagina !== pagina || response.limite !== EXPORT_PAGE_LIMIT) throw new Error('La respuesta de clientes no corresponde a la página solicitada.')
    if (totalPaginas === null) totalPaginas = response.totalPaginas
    if (totalClientes === null) totalClientes = response.total
    if (response.totalPaginas !== totalPaginas) throw new Error('La paginación de clientes cambió durante la exportación.')
    if (response.total !== totalClientes) throw new Error('El total de clientes cambió durante la exportación.')
    if (response.totalPaginas !== Math.ceil(response.total / EXPORT_PAGE_LIMIT)) throw new Error('La respuesta de clientes tiene una cantidad de páginas inválida.')
    if (response.datos.length > EXPORT_PAGE_LIMIT) throw new Error('La respuesta de clientes excede el límite solicitado.')
    for (const cliente of response.datos) {
      if (!ids.has(cliente.id)) {
        ids.add(cliente.id)
        clientes.push(cliente)
      }
    }
    if (pagina >= totalPaginas) break
    pagina += 1
  }

  if (totalPaginas === null || totalClientes === null || clientes.length !== totalClientes) throw new Error('No se pudo completar la exportación de clientes.')
  return clientes
}

export const resumirClientes = (repository: ClienteRepository) => repository.summary()
export const obtenerCliente = (repository: ClienteRepository, id: number) => repository.getById(id)
export const crearCliente = (repository: ClienteRepository, input: CrearClienteInput) => repository.create(input)
export const actualizarCliente = (repository: ClienteRepository, id: number, input: ActualizarClienteInput) => repository.update(id, input)
export const cambiarEstadoCliente = (repository: ClienteRepository, id: number, activo: boolean) => repository.changeStatus(id, activo)
export const obtenerAnalisisFinanciero = (repository: ClienteRepository, id: number) => repository.getFinancialAnalysis(id)
