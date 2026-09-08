export interface FormaPago {
  id: number
  nombre: string
  activo: boolean
}

export interface FormaPagoInput {
  nombre: string
}

export interface FormasPagoPaginadas {
  datos: FormaPago[]
  pagina: number
  limite: number
  total: number
  totalPaginas: number
}

export interface FormaPagoRepository {
  list(): Promise<FormaPago[]>
  listAdministration(pagina: number, limite: number): Promise<FormasPagoPaginadas>
  getById(id: number): Promise<FormaPago>
  create(input: FormaPagoInput): Promise<FormaPago>
  update(id: number, input: FormaPagoInput): Promise<FormaPago>
  changeStatus(id: number, activo: boolean): Promise<FormaPago>
}
