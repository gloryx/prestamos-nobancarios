import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import Swal from 'sweetalert2'
import { Pagination } from '@/shared/components/Pagination'
import { formatCRC } from '@/shared/utils/currency'
import { formatDateOnly, todayInCostaRica } from '@/shared/utils/date'
import { AxiosPrestamoRepository } from '../infrastructure/axios-prestamo.repository'
import { cambiarEstadoPrestamo, listarCandidatosIncobrables, listarIncobrables, resumirPrestamos } from '../application/prestamos.use-cases'
import type { IncobrableLoan, IncobrablesFilters, IncobrablesPage, PrestamoFilters, PrestamosResumen } from '../domain/prestamo.types'
import { prestamoErrorMessage } from '../domain/prestamo.error'
import './gestion-incobrables.css'
import './prestamos-list.css'
import './saldados.css'

const repository = new AxiosPrestamoRepository()
const today = todayInCostaRica
const date = formatDateOnly

export function GestionIncobrablesPage() {
  const [tab, setTab] = useState<'vencidos' | 'incobrables'>('vencidos')
  const [page, setPage] = useState<IncobrablesPage>({ datos: [], pagina: 1, limite: 10, total: 0, totalPaginas: 0 })
  const [filters, setFilters] = useState<IncobrablesFilters>({ pagina: 1, limite: 10, fechaReferencia: today(), ordenarPor: 'fechaVencimiento', direccionOrden: 'ASC' })
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState<PrestamosResumen | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryBlocked, setSummaryBlocked] = useState(false)
  const [selected, setSelected] = useState<IncobrableLoan | null>(null)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      if (tab === 'vencidos') {
        setPage(await listarCandidatosIncobrables(repository, filters))
        setSummary(null)
        setSummaryBlocked(true)
      } else {
        setSummaryLoading(true)
        const summaryFilters: PrestamoFilters = { pagina: 1, limite: 10, estados: ['INCOBRABLE'], buscar: filters.buscar, direccion: filters.direccion }
        const [nextPage, nextSummary] = await Promise.all([listarIncobrables(repository, filters), resumirPrestamos(repository, summaryFilters)])
        setPage(nextPage)
        setSummary(nextSummary)
        setSummaryBlocked(false)
      }
    } catch (cause) { setError(prestamoErrorMessage(cause)) } finally { setLoading(false); setSummaryLoading(false) }
  }, [filters, tab])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 350)
    return () => window.clearTimeout(timeout)
  }, [search])
  useEffect(() => {
    setFilters((current) => ({ ...current, buscar: debouncedSearch.trim() || undefined, pagina: 1 }))
  }, [debouncedSearch])
  const updateSearch = (value: string) => { setSearch(value); setFilters((current) => ({ ...current, pagina: 1 })) }
  const changeTab = (value: 'vencidos' | 'incobrables') => { setTab(value); setFilters((current) => ({ ...current, pagina: 1, ordenarPor: value === 'vencidos' ? 'fechaVencimiento' : 'fechaIncobrable' })) }
  const submit = async (fecha: string, observacion: string) => {
    if (!selected || !fecha || !observacion.trim()) return
    try { await cambiarEstadoPrestamo(repository, selected.id, { estado: tab === 'vencidos' ? 'INCOBRABLE' : 'ACTIVO', fecha, observacion: observacion.trim() }); setSelected(null); await load(); await Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: tab === 'vencidos' ? 'Préstamo marcado como incobrable.' : 'Préstamo reactivado.', showConfirmButton: false, timer: 2200 }) } catch (cause) { await Swal.fire({ icon: 'error', title: 'No se pudo actualizar', text: prestamoErrorMessage(cause) }) }
  }
  return <section className="gestion-incobrables-page">
    <div className="page-heading"><div><p className="eyebrow">PRÉSTAMOS</p><h1>Gestión de incobrables</h1><p className="muted">Revisa obligaciones vencidas y administra el ciclo de incobrabilidad.</p></div><button className="secondary-button" onClick={() => void load()} disabled={loading}><RefreshCw size={16} /> Actualizar</button></div>
    <div className="incobrables-tabs" role="tablist"><button className={tab === 'vencidos' ? 'active' : ''} onClick={() => changeTab('vencidos')}>Vencidos</button><button className={tab === 'incobrables' ? 'active' : ''} onClick={() => changeTab('incobrables')}>Incobrables</button></div>
     <div className="panel saldados-toolbar"><label>Cliente<input value={search} onChange={(event) => updateSearch(event.target.value)} placeholder="Nombre completo, identificación, teléfono o dirección" /></label><label>Fecha de referencia<input type="date" value={filters.fechaReferencia ?? ''} onChange={(event) => setFilters((current) => ({ ...current, fechaReferencia: event.target.value, pagina: 1 }))} /></label></div>
     <div className="prestamos-financial-summary" aria-label="Resumen financiero de préstamos incobrables"><div><span>TOTAL</span><strong>{summary ? summary.total.toLocaleString('es-CR') : '—'}</strong></div><div><span>PRESTADO</span><strong>{summary ? formatCRC(summary.prestado) : '—'}</strong></div><div><span>GANANCIA</span><strong>{summary ? formatCRC(summary.ganancia) : '—'}</strong></div><div><span>PENDIENTE</span><strong>{summary ? formatCRC(summary.pendiente) : '—'}</strong></div>{summaryLoading && <small aria-live="polite">Cargando...</small>}</div>
     {summaryBlocked && <p className="form-note" role="status">El resumen financiero de vencidos no está disponible en el endpoint actual; no se calcula sobre la página visible.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="panel table-wrap">{loading ? <div className="state-box">Cargando información...</div> : !page.datos.length ? <div className="state-box">No hay registros para mostrar.</div> : <table><thead><tr><th>Cliente</th><th>Saldo pendiente</th>{tab === 'vencidos' ? <><th>Vencimiento</th><th>Saldo cuota</th></> : <><th>Fecha incobrable</th><th>Días en estado</th><th>Último pago</th><th>Observación</th></>}<th>Acción</th></tr></thead><tbody>{page.datos.map((loan) => <tr key={loan.id}><td><strong>{loan.cliente.nombreCompleto}</strong><small>{loan.cliente.identificacion}</small></td><td>{formatCRC(loan.saldoPendiente)}</td>{tab === 'vencidos' ? <><td>{date(loan.fechaVencimiento)}</td><td>{formatCRC(loan.saldoCuota ?? 0)}</td></> : <><td>{date(loan.fechaIncobrable)}</td><td>{loan.diasEnEstado ?? 0}</td><td>{date(loan.ultimaFechaPago)}</td><td>{loan.observacionIncobrable || '—'}</td></>}<td><button className="primary-button" onClick={() => setSelected(loan)}>{tab === 'vencidos' ? 'Marcar incobrable' : 'Reactivar'}</button></td></tr>)}</tbody></table>}</div>
    <Pagination pagina={page.pagina} totalPaginas={page.totalPaginas} total={page.total} limite={page.limite} opcionesLimite={[10, 25, 50, 100]} onPageChange={(pagina) => setFilters((current) => ({ ...current, pagina }))} onLimitChange={(limite) => setFilters((current) => ({ ...current, limite, pagina: 1 }))} label="préstamos" loading={loading} />
    {selected && <IncobrableModal loan={selected} action={tab === 'vencidos' ? 'INCOBRABLE' : 'ACTIVO'} onClose={() => setSelected(null)} onSubmit={submit} />}
  </section>
}

function IncobrableModal({ loan, action, onClose, onSubmit }: { loan: IncobrableLoan; action: 'ACTIVO' | 'INCOBRABLE'; onClose: () => void; onSubmit: (fecha: string, observacion: string) => Promise<void> }) {
  const [fecha, setFecha] = useState(today()); const [observacion, setObservacion] = useState('')
  return <div className="prestamo-cancellation-backdrop" role="presentation"><div className="prestamo-cancellation-modal" role="dialog" aria-modal="true" aria-labelledby="incobrable-modal-title"><h2 id="incobrable-modal-title">{action === 'INCOBRABLE' ? 'Marcar préstamo como incobrable' : 'Reactivar préstamo'}</h2><p>{loan.cliente.nombreCompleto} · saldo {formatCRC(loan.saldoPendiente)}</p><label className="prestamo-cancellation-field">Fecha *<input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} required /></label><label className="prestamo-cancellation-field">Observación *<textarea value={observacion} onChange={(event) => setObservacion(event.target.value)} maxLength={500} required /></label><div className="prestamo-detail-actions"><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={!fecha || !observacion.trim()} onClick={() => void onSubmit(fecha, observacion)}>Confirmar</button></div></div></div>
}
