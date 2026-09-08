import type { FormaPagoInput, FormaPagoRepository } from '../domain/forma-pago.types'

export const listFormasPago = (repository: FormaPagoRepository) => repository.list()
export const listFormasPagoAdministration = (repository: FormaPagoRepository, pagina: number, limite: number) => repository.listAdministration(pagina, limite)
export const getFormaPago = (repository: FormaPagoRepository, id: number) => repository.getById(id)
export const createFormaPago = (repository: FormaPagoRepository, input: FormaPagoInput) => repository.create(input)
export const updateFormaPago = (repository: FormaPagoRepository, id: number, input: FormaPagoInput) => repository.update(id, input)
export const changeFormaPagoStatus = (repository: FormaPagoRepository, id: number, activo: boolean) => repository.changeStatus(id, activo)
