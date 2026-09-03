import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Power } from 'lucide-react'
import { useAuth } from '@/app/providers/auth-context'
import { changePeriodicidadStatus, createPeriodicidad, listPeriodicidades, updatePeriodicidad } from '../application/periodicidades-pago.use-cases'
import { periodicidadErrorMessage } from '../domain/periodicidad-pago.error'
import type { Periodicidad, PeriodicidadInput } from '../domain/periodicidad-pago.types'
import { AxiosPeriodicidadRepository } from '../infrastructure/axios-periodicidad.repository'
import { PeriodicidadForm } from './PeriodicidadForm'

const repository = new AxiosPeriodicidadRepository()

export function PeriodicidadesPage() {
  const { user } = useAuth()
  const isAdmin = user?.rol === 'ADMINISTRADOR'
  const [periodicidades, setPeriodicidades] = useState<Periodicidad[]>([])
  const [editing, setEditing] = useState<Periodicidad | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setPeriodicidades(await listPeriodicidades(repository)); setError('') } catch (cause) { setSuccess(''); setError(periodicidadErrorMessage(cause)) } finally { setLoading(false) }
  }, [])

  useEffect(() => { let cancelled = false; void listPeriodicidades(repository).then((result) => { if (!cancelled) { setPeriodicidades(result); setError(''); setLoading(false) } }).catch((cause) => { if (!cancelled) { setSuccess(''); setError(periodicidadErrorMessage(cause)); setLoading(false) } }); return () => { cancelled = true } }, [])

  const save = async (input: PeriodicidadInput) => { setSuccess(''); try { if (editing) { await updatePeriodicidad(repository, editing.id, input); setSuccess('Periodicidad actualizada correctamente.') } else { await createPeriodicidad(repository, input); setSuccess('Periodicidad creada correctamente.') } setEditing(undefined); await load() } catch (cause) { setError(periodicidadErrorMessage(cause)) } }
  const toggle = async (periodicidad: Periodicidad) => { if (!window.confirm(`${periodicidad.activo ? 'Inactivar' : 'Activar'} la periodicidad ${periodicidad.nombre}?`)) return; setSuccess(''); try { await changePeriodicidadStatus(repository, periodicidad.id, !periodicidad.activo); setSuccess(`Periodicidad ${periodicidad.activo ? 'inactivada' : 'activada'} correctamente.`); await load() } catch (cause) { setError(periodicidadErrorMessage(cause)) } }

  if (editing !== undefined) return <section><div className="page-heading"><div><p className="eyebrow">CONFIGURACIÓN</p><h1>{editing ? 'Editar periodicidad' : 'Nueva periodicidad'}</h1></div></div><div className="panel usuario-panel"><PeriodicidadForm periodicidad={editing ?? undefined} onCancel={() => setEditing(undefined)} onSubmit={save} /></div></section>
  return <section><div className="page-heading"><div><p className="eyebrow">CONFIGURACIÓN</p><h1>Periodicidades</h1><p className="muted">Administra las periodicidades disponibles para los préstamos.</p></div>{isAdmin && <button className="primary-button" onClick={() => { setSuccess(''); setEditing(null) }}><Plus size={16} /> Nueva periodicidad</button>}</div>{error && <p className="form-error" role="alert">{error}</p>}{success && <p className="form-success" role="status">{success}</p>}{loading ? <div className="panel state-box" aria-live="polite">Cargando periodicidades...</div> : !periodicidades.length ? <div className="panel state-box">No hay periodicidades para mostrar.</div> : <div className="panel table-wrap usuario-panel"><table><thead><tr><th>Nombre</th><th>Estado</th>{isAdmin && <th>Acciones</th>}</tr></thead><tbody>{periodicidades.map((periodicidad) => <tr key={periodicidad.id}><td>{periodicidad.nombre}</td><td><span className={`status-badge ${periodicidad.activo ? 'active' : 'inactive'}`}>{periodicidad.activo ? 'Activo' : 'Inactivo'}</span></td>{isAdmin && <td><button className="table-action" onClick={() => { setSuccess(''); setEditing(periodicidad) }} aria-label={`Editar ${periodicidad.nombre}`}><Pencil size={15} /></button><button className="table-action" onClick={() => void toggle(periodicidad)} aria-label={`${periodicidad.activo ? 'Inactivar' : 'Activar'} ${periodicidad.nombre}`}><Power size={15} /></button></td>}</tr>)}</tbody></table></div>}</section>
}
