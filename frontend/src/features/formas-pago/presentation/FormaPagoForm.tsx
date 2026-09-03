import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { FormaPago, FormaPagoInput } from '../domain/forma-pago.types'

const schema = z.object({ nombre: z.string().trim().min(1, 'El nombre es obligatorio.').max(50, 'Máximo 50 caracteres.') })
type Values = z.infer<typeof schema>

export function FormaPagoForm({ formaPago, onCancel, onSubmit }: { formaPago?: FormaPago; onCancel: () => void; onSubmit: (input: FormaPagoInput) => Promise<void> }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { nombre: formaPago?.nombre ?? '' } })
  useEffect(() => { reset({ nombre: formaPago?.nombre ?? '' }) }, [formaPago, reset])
  const submit = async (values: Values) => onSubmit({ nombre: values.nombre.trim() })

  return <form className="usuario-form" onSubmit={handleSubmit(submit)} noValidate>
    <div className="usuario-form-grid">
      <label>Nombre<input autoFocus {...register('nombre')} aria-invalid={!!errors.nombre} maxLength={50} />{errors.nombre && <small className="field-error">{errors.nombre.message}</small>}</label>
    </div>
    <div className="usuario-form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancelar</button><button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : formaPago ? 'Guardar cambios' : 'Crear forma de pago'}</button></div>
  </form>
}
