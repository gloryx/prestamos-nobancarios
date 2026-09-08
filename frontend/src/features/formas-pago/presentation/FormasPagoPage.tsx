import { useCallback, useEffect, useRef, useState } from 'react'
import { Pencil, Plus, Power } from 'lucide-react'
import { useAuth } from '@/app/providers/auth-context'
import { changeFormaPagoStatus, createFormaPago, listFormasPagoAdministration, updateFormaPago } from '../application/formas-pago.use-cases'
import { formaPagoErrorMessage } from '../domain/forma-pago.error'
import type { FormaPago, FormaPagoInput } from '../domain/forma-pago.types'
import { AxiosFormaPagoRepository } from '../infrastructure/axios-forma-pago.repository'
import { confirmAction } from '@/shared/utils/sweet-alert'
import { FormaPagoForm } from './FormaPagoForm'
import { Pagination } from '@/shared/components/Pagination'

const repository = new AxiosFormaPagoRepository()

export function FormasPagoPage() {
  const { user } = useAuth()
  const isAdmin = user?.rol === 'ADMINISTRADOR'
  const [formasPago, setFormasPago] = useState<FormaPago[]>([])
  const [editing, setEditing] = useState<FormaPago | null | undefined>(undefined)
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
    try { const result = await listFormasPagoAdministration(repository, pagina, limite); if (currentRequest !== requestId.current) return; setFormasPago(result.datos); setTotal(result.total); setTotalPaginas(result.totalPaginas); setError('') } catch (cause) { if (currentRequest !== requestId.current) return; setSuccess(''); setError(formaPagoErrorMessage(cause)) } finally { if (currentRequest === requestId.current) setLoading(false) }
  }, [pagina, limite])

  useEffect(() => { void load() }, [load])

  const save = async (input: FormaPagoInput) => { setSuccess(''); try { if (editing) { await updateFormaPago(repository, editing.id, input); setSuccess('Forma de pago actualizada correctamente.') } else { await createFormaPago(repository, input); setSuccess('Forma de pago creada correctamente.') } setEditing(undefined); await load() } catch (cause) { setError(formaPagoErrorMessage(cause)) } }
  const toggle = async (formaPago: FormaPago) => {
    if (processingId !== null) return
    const disabling = formaPago.activo
    setProcessingId(formaPago.id)
    try {
      const confirmed = await confirmAction({
        title: disabling ? 'Deshabilitar forma de pago' : 'Habilitar forma de pago',
        text: disabling ? '¿Está seguro de que desea deshabilitar esta forma de pago?' : '¿Está seguro de que desea habilitar esta forma de pago?',
        confirmButtonText: disabling ? 'Sí, deshabilitar' : 'Sí, habilitar',
        loadingTitle: disabling ? 'Deshabilitando forma de pago...' : 'Habilitando forma de pago...',
        successTitle: disabling ? 'Forma de pago deshabilitada' : 'Forma de pago habilitada',
        errorTitle: disabling ? 'No se pudo deshabilitar la forma de pago' : 'No se pudo habilitar la forma de pago',
        getErrorMessage: formaPagoErrorMessage,
        action: async () => {
          try { await changeFormaPagoStatus(repository, formaPago.id, !formaPago.activo) } catch (cause) { setError(formaPagoErrorMessage(cause)); throw cause }
        },
      })
      if (!confirmed) return
      setSuccess('')
      setSuccess(`Forma de pago ${formaPago.activo ? 'inactivada' : 'activada'} correctamente.`)
      await load()
    } catch (cause) { setError(formaPagoErrorMessage(cause)) } finally { setProcessingId(null) }
  }

  if (editing !== undefined) return <section><div className="page-heading"><div><p className="eyebrow">CONFIGURACIÓN</p><h1>{editing ? 'Editar forma de pago' : 'Nueva forma de pago'}</h1></div></div><div className="panel usuario-panel"><FormaPagoForm formaPago={editing ?? undefined} onCancel={() => setEditing(undefined)} onSubmit={save} /></div></section>
  return <section><div className="page-heading"><div><p className="eyebrow">CONFIGURACIÓN</p><h1>Formas de pago</h1><p className="muted">Administra las formas de pago disponibles para préstamos y pagos.</p></div>{isAdmin && <button className="primary-button" onClick={() => { setSuccess(''); setEditing(null) }}><Plus size={16} /> Nueva forma de pago</button>}</div>{error && <p className="form-error" role="alert">{error}</p>}{success && <p className="form-success" role="status">{success}</p>}{loading ? <div className="panel state-box" aria-live="polite">Cargando formas de pago...</div> : !formasPago.length ? <div className="panel state-box">No hay formas de pago para mostrar.</div> : <div className="panel table-wrap usuario-panel"><table><thead><tr><th>Nombre</th><th>Estado</th>{isAdmin && <th>Acciones</th>}</tr></thead><tbody>{formasPago.map((formaPago) => <tr key={formaPago.id}><td>{formaPago.nombre}</td><td><span className={`status-badge ${formaPago.activo ? 'active' : 'inactive'}`}>{formaPago.activo ? 'Activo' : 'Inactivo'}</span></td>{isAdmin && <td><button className="table-action" onClick={() => { setSuccess(''); setEditing(formaPago) }} aria-label={`Editar ${formaPago.nombre}`}><Pencil size={15} /></button><button className="table-action" disabled={processingId === formaPago.id} onClick={() => void toggle(formaPago)} aria-label={`${formaPago.activo ? 'Inactivar' : 'Activar'} ${formaPago.nombre}`}><Power size={15} /></button></td>}</tr>)}</tbody></table></div>} {!loading && <Pagination pagina={pagina} totalPaginas={totalPaginas} total={total} limite={limite} opcionesLimite={[10, 25, 50, 100]} onPageChange={setPagina} onLimitChange={(value) => { setPagina(1); setLimite(value) }} label="formas de pago" loading={loading} />}</section>
}
