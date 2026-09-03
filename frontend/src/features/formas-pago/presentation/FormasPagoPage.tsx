import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Power } from 'lucide-react'
import { useAuth } from '@/app/providers/auth-context'
import { changeFormaPagoStatus, createFormaPago, listFormasPago, updateFormaPago } from '../application/formas-pago.use-cases'
import { formaPagoErrorMessage } from '../domain/forma-pago.error'
import type { FormaPago, FormaPagoInput } from '../domain/forma-pago.types'
import { AxiosFormaPagoRepository } from '../infrastructure/axios-forma-pago.repository'
import { FormaPagoForm } from './FormaPagoForm'

const repository = new AxiosFormaPagoRepository()

export function FormasPagoPage() {
  const { user } = useAuth()
  const isAdmin = user?.rol === 'ADMINISTRADOR'
  const [formasPago, setFormasPago] = useState<FormaPago[]>([])
  const [editing, setEditing] = useState<FormaPago | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setFormasPago(await listFormasPago(repository)); setError('') } catch (cause) { setSuccess(''); setError(formaPagoErrorMessage(cause)) } finally { setLoading(false) }
  }, [])

  useEffect(() => { let cancelled = false; void listFormasPago(repository).then((result) => { if (!cancelled) { setFormasPago(result); setError(''); setLoading(false) } }).catch((cause) => { if (!cancelled) { setSuccess(''); setError(formaPagoErrorMessage(cause)); setLoading(false) } }); return () => { cancelled = true } }, [])

  const save = async (input: FormaPagoInput) => { setSuccess(''); try { if (editing) { await updateFormaPago(repository, editing.id, input); setSuccess('Forma de pago actualizada correctamente.') } else { await createFormaPago(repository, input); setSuccess('Forma de pago creada correctamente.') } setEditing(undefined); await load() } catch (cause) { setError(formaPagoErrorMessage(cause)) } }
  const toggle = async (formaPago: FormaPago) => { if (!window.confirm(`${formaPago.activo ? 'Inactivar' : 'Activar'} la forma de pago ${formaPago.nombre}?`)) return; setSuccess(''); try { await changeFormaPagoStatus(repository, formaPago.id, !formaPago.activo); setSuccess(`Forma de pago ${formaPago.activo ? 'inactivada' : 'activada'} correctamente.`); await load() } catch (cause) { setError(formaPagoErrorMessage(cause)) } }

  if (editing !== undefined) return <section><div className="page-heading"><div><p className="eyebrow">CONFIGURACIÓN</p><h1>{editing ? 'Editar forma de pago' : 'Nueva forma de pago'}</h1></div></div><div className="panel usuario-panel"><FormaPagoForm formaPago={editing ?? undefined} onCancel={() => setEditing(undefined)} onSubmit={save} /></div></section>
  return <section><div className="page-heading"><div><p className="eyebrow">CONFIGURACIÓN</p><h1>Formas de pago</h1><p className="muted">Administra las formas de pago disponibles para préstamos y pagos.</p></div>{isAdmin && <button className="primary-button" onClick={() => { setSuccess(''); setEditing(null) }}><Plus size={16} /> Nueva forma de pago</button>}</div>{error && <p className="form-error" role="alert">{error}</p>}{success && <p className="form-success" role="status">{success}</p>}{loading ? <div className="panel state-box" aria-live="polite">Cargando formas de pago...</div> : !formasPago.length ? <div className="panel state-box">No hay formas de pago para mostrar.</div> : <div className="panel table-wrap usuario-panel"><table><thead><tr><th>Nombre</th><th>Estado</th>{isAdmin && <th>Acciones</th>}</tr></thead><tbody>{formasPago.map((formaPago) => <tr key={formaPago.id}><td>{formaPago.nombre}</td><td><span className={`status-badge ${formaPago.activo ? 'active' : 'inactive'}`}>{formaPago.activo ? 'Activo' : 'Inactivo'}</span></td>{isAdmin && <td><button className="table-action" onClick={() => { setSuccess(''); setEditing(formaPago) }} aria-label={`Editar ${formaPago.nombre}`}><Pencil size={15} /></button><button className="table-action" onClick={() => void toggle(formaPago)} aria-label={`${formaPago.activo ? 'Inactivar' : 'Activar'} ${formaPago.nombre}`}><Power size={15} /></button></td>}</tr>)}</tbody></table></div>}</section>
}
