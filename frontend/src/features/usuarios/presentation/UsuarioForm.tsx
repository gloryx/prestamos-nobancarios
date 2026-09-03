import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ActualizarUsuarioInput, CrearUsuarioInput, Usuario } from '../domain/usuario.types'

const schema = (isEditing: boolean) => z.object({
  identificacion: z.string().trim().min(1, 'La identificación es obligatoria.').max(30, 'Máximo 30 caracteres.'),
  nombreCompleto: z.string().trim().min(1, 'El nombre es obligatorio.').max(200, 'Máximo 200 caracteres.'),
  telefono: z.string().max(30, 'Máximo 30 caracteres.'),
  correo: z.union([z.literal(''), z.string().email('Ingresá un correo válido.').max(150, 'Máximo 150 caracteres.')]),
  rol: z.enum(['ADMINISTRADOR', 'VENDEDOR']),
  password: isEditing
    ? z.union([z.literal(''), z.string().min(8, 'Mínimo 8 caracteres.').max(200, 'Máximo 200 caracteres.')])
    : z.string().min(8, 'Mínimo 8 caracteres.').max(200, 'Máximo 200 caracteres.'),
})
type Values = z.infer<ReturnType<typeof schema>>
const clean = (value: string) => value.trim() || null
const defaultValues = (usuario?: Usuario): Values => ({
  identificacion: usuario?.identificacion ?? '',
  nombreCompleto: usuario?.nombreCompleto ?? '',
  telefono: usuario?.telefono ?? '',
  correo: usuario?.correo ?? '',
  rol: usuario?.rol ?? 'VENDEDOR',
  password: '',
})

export function UsuarioForm({ usuario, onCancel, onSubmit }: { usuario?: Usuario; onCancel: () => void; onSubmit: (input: CrearUsuarioInput | ActualizarUsuarioInput) => Promise<void> }) {
  const [showPassword, setShowPassword] = useState(false)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema(Boolean(usuario))), defaultValues: defaultValues(usuario) })
  useEffect(() => { reset(defaultValues(usuario)) }, [usuario, reset])
  const submit = async (values: Values) => {
    if (!usuario) return onSubmit({ identificacion: values.identificacion.trim(), nombreCompleto: values.nombreCompleto.trim(), telefono: clean(values.telefono), correo: clean(values.correo)?.toLowerCase() ?? null, rol: values.rol, password: values.password ?? '' })
    const input: ActualizarUsuarioInput = {
      identificacion: values.identificacion.trim(),
      nombreCompleto: values.nombreCompleto.trim(),
      telefono: clean(values.telefono),
      correo: clean(values.correo)?.toLowerCase() ?? null,
      rol: values.rol,
    }
    return onSubmit(input)
  }
  return <form className="usuario-form" onSubmit={handleSubmit(submit)} noValidate>
    <div className="usuario-form-grid">
      <label>Identificación<input {...register('identificacion')} aria-invalid={!!errors.identificacion} />{errors.identificacion && <small className="field-error">{errors.identificacion.message}</small>}</label>
      <label>Nombre completo<input {...register('nombreCompleto')} aria-invalid={!!errors.nombreCompleto} />{errors.nombreCompleto && <small className="field-error">{errors.nombreCompleto.message}</small>}</label>
      <label>Teléfono<input {...register('telefono')} />{errors.telefono && <small className="field-error">{errors.telefono.message}</small>}</label>
      <label>Correo electrónico<input type="email" {...register('correo')} />{errors.correo && <small className="field-error">{errors.correo.message}</small>}</label>
      <label>Rol<select {...register('rol')}><option value="VENDEDOR">Vendedor</option><option value="ADMINISTRADOR">Administrador</option></select></label>
      {!usuario && <label>Contraseña<div className="password-field"><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" {...register('password')} /><button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{errors.password && <small className="field-error">{errors.password.message}</small>}</label>}
    </div>
    <div className="usuario-form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancelar</button><button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : 'Guardar usuario'}</button></div>
  </form>
}
