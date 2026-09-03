import { useState } from 'react'
import { Eye, EyeOff, WalletMinimal } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/providers/auth-context'

const schema = z.object({ identificacion: z.string().trim().min(1, 'La identificación es obligatoria.'), password: z.string().min(1, 'La contraseña es obligatoria.') })
type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const { login, error, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { identificacion: '', password: '' } })
  const destination = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/'
  if (isAuthenticated) return <Navigate to={destination} replace />
  const onSubmit = async (values: FormValues) => { if (await login(values)) navigate(destination, { replace: true }) }
  return <main className="login-page"><section className="login-card" aria-labelledby="login-title"><div className="login-brand"><div className="brand-mark"><WalletMinimal size={22} /></div><strong>Finan<span>za</span></strong></div><div className="login-heading"><p className="eyebrow">ACCESO SEGURO</p><h1 id="login-title">Bienvenido</h1><p className="muted">Ingresá tus credenciales para continuar.</p></div><form onSubmit={handleSubmit(onSubmit)} noValidate><label htmlFor="identificacion">Identificación</label><input id="identificacion" autoComplete="username" {...register('identificacion')} aria-invalid={Boolean(errors.identificacion)} />{errors.identificacion && <span className="field-error">{errors.identificacion.message}</span>}<label htmlFor="password">Contraseña</label><div className="password-field"><input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" {...register('password')} aria-invalid={Boolean(errors.password)} /><button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{errors.password && <span className="field-error">{errors.password.message}</span>}{error && <p className="form-error" role="alert">{error}</p>}<button className="login-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Ingresando...' : 'Iniciar sesión'}</button></form></section></main>
}
