export interface FormaPago {
  id: number
  nombre: string
  activo: boolean
}

export interface FormaPagoInput {
  nombre: string
}

export interface FormaPagoRepository {
  list(): Promise<FormaPago[]>
  getById(id: number): Promise<FormaPago>
  create(input: FormaPagoInput): Promise<FormaPago>
  update(id: number, input: FormaPagoInput): Promise<FormaPago>
  changeStatus(id: number, activo: boolean): Promise<FormaPago>
}
