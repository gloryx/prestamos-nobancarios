import { useCallback, useEffect, useRef, useState } from 'react'
import { Pencil, Plus, Power } from 'lucide-react'
import { useAuth } from '@/app/providers/auth-context'
import { changePeriodicidadStatus, createPeriodicidad, listPeriodicidadesAdministration, updatePeriodicidad } from '../application/periodicidades-pago.use-cases'
import { periodicidadErrorMessage } from '../domain/periodicidad-pago.error'
import type { Periodicidad, PeriodicidadInput } from '../domain/periodicidad-pago.types'
import { AxiosPeriodicidadRepository } from '../infrastructure/axios-periodicidad.repository'
import { confirmAction } from '@/shared/utils/sweet-alert'
import { PeriodicidadForm } from './PeriodicidadForm'
import { Pagination } from '@/shared/components/Pagination'

const repository = new AxiosPeriodicidadRepository()

export function PeriodicidadesPage() {
  const { user } = useAuth()
  const isAdmin = user?.rol === 'ADMINISTRADOR'
  const [periodicidades, setPeriodicidades] = useState<Periodicidad[]>([])
  const [editing, setEditing] = useState<Periodicidad | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [pagina, setPagina] = useState(1)
  const [limite, setLimite] = useState(10)
  const [total, setTotal] = useState(0)
  const [totalPaginas, setTotalPaginas] = useState(0)
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true)
    try { const result = await listPeriodicidadesAdministration(repository, pagina, limite); if (currentRequest !== requestId.current) return; setPeriodicidades(result.datos); setTotal(result.total); setTotalPaginas(result.totalPaginas); setError('') } catch (cause) { if (currentRequest !== requestId.current) return; setSuccess(''); setError(periodicidadErrorMessage(cause)) } finally { if (currentRequest === requestId.current) setLoading(false) }
  }, [pagina, limite])

  useEffect(() => { void load() }, [load])

  const save = async (input: PeriodicidadInput) => { setSuccess(''); try { if (editing) { await updatePeriodicidad(repository, editing.id, input); setSuccess('Periodicidad actualizada correctamente.') } else { await createPeriodicidad(repository, input); setSuccess('Periodicidad creada correctamente.') } setEditing(undefined); await load() } catch (cause) { setError(periodicidadErrorMessage(cause)) } }
  const toggle = async (periodicidad: Periodicidad) => {
    if (processingId !== null) return
    const disabling = periodicidad.activo
    setProcessingId(periodicidad.id)
    try {
      const confirmed = await confirmAction({
        title: disabling ? 'Deshabilitar periodicidad' : 'Habilitar periodicidad',
        text: disabling ? '¿Está seguro de que desea deshabilitar esta periodicidad?' : '¿Está seguro de que desea habilitar esta periodicidad?',
        confirmButtonText: disabling ? 'Sí, deshabilitar' : 'Sí, habilitar',
        loadingTitle: disabling ? 'Deshabilitando periodicidad...' : 'Habilitando periodicidad...',
        successTitle: disabling ? 'Periodicidad deshabilitada' : 'Periodicidad habilitada',
        errorTitle: disabling ? 'No se pudo deshabilitar la periodicidad' : 'No se pudo habilitar la periodicidad',
        getErrorMessage: periodicidadErrorMessage,
        action: async () => {
          try { await changePeriodicidadStatus(repository, periodicidad.id, !periodicidad.activo) } catch (cause) { setError(periodicidadErrorMessage(cause)); throw cause }
        },
      })
      if (!confirmed) return
      setSuccess('')
      setSuccess(`Periodicidad ${periodicidad.activo ? 'inactivada' : 'activada'} correctamente.`)
      await load()
    } catch (cause) { setError(periodicidadErrorMessage(cause)) } finally { setProcessingId(null) }
  }

  if (editing !== undefined) return <section><div className="page-heading"><div><p className="eyebrow">CONFIGURACIÓN</p><h1>{editing ? 'Editar periodicidad' : 'Nueva periodicidad'}</h1></div></div><div className="panel usuario-panel"><PeriodicidadForm periodicidad={editing ?? undefined} onCancel={() => setEditing(undefined)} onSubmit={save} /></div></section>
  return <section><div className="page-heading"><div><p className="eyebrow">CONFIGURACIÓN</p><h1>Periodicidades</h1><p className="muted">Administra las periodicidades disponibles para los préstamos.</p></div>{isAdmin && <button className="primary-button" onClick={() => { setSuccess(''); setEditing(null) }}><Plus size={16} /> Nueva periodicidad</button>}</div>{error && <p className="form-error" role="alert">{error}</p>}{success && <p className="form-success" role="status">{success}</p>}{loading ? <div className="panel state-box" aria-live="polite">Cargando periodicidades...</div> : !periodicidades.length ? <div className="panel state-box">No hay periodicidades para mostrar.</div> : <div className="panel table-wrap usuario-panel"><table><thead><tr><th>Nombre</th><th>Estado</th>{isAdmin && <th>Acciones</th>}</tr></thead><tbody>{periodicidades.map((periodicidad) => <tr key={periodicidad.id}><td>{periodicidad.nombre}</td><td><span className={`status-badge ${periodicidad.activo ? 'active' : 'inactive'}`}>{periodicidad.activo ? 'Activo' : 'Inactivo'}</span></td>{isAdmin && <td><button className="table-action" onClick={() => { setSuccess(''); setEditing(periodicidad) }} aria-label={`Editar ${periodicidad.nombre}`}><Pencil size={15} /></button><button className="table-action" disabled={processingId === periodicidad.id} onClick={() => void toggle(periodicidad)} aria-label={`${periodicidad.activo ? 'Inactivar' : 'Activar'} ${periodicidad.nombre}`}><Power size={15} /></button></td>}</tr>)}</tbody></table></div>} {!loading && <Pagination pagina={pagina} totalPaginas={totalPaginas} total={total} limite={limite} opcionesLimite={[10, 25, 50, 100]} onPageChange={setPagina} onLimitChange={(value) => { setPagina(1); setLimite(value) }} label="periodicidades" loading={loading} />}</section>
}
