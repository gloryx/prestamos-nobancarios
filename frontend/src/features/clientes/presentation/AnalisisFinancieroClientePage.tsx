import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Printer, Search, X } from 'lucide-react'
import { listarClientes, obtenerAnalisisFinanciero } from '../application/clientes.use-cases'
import { clienteErrorMessage } from '../domain/cliente.error'
import type { AnalisisFinancieroPrestamo, AnalisisFinancieroResponse, Cliente, ClienteFilters, ClientePage } from '../domain/cliente.types'
import { AxiosClienteRepository } from '../infrastructure/axios-cliente.repository'
import { AxiosPrestamoRepository } from '@/features/prestamos/infrastructure/axios-prestamo.repository'
import { abrirEstadoCuentaPdf } from '@/features/prestamos/application/prestamos.use-cases'
import { formatCRC } from '@/shared/utils/currency'
import './analisis-financiero-cliente.css'

const clienteRepository = new AxiosClienteRepository()
const prestamoRepository = new AxiosPrestamoRepository()
const nombreCliente = (c: Cliente) => [c.primerNombre, c.segundoNombre, c.primerApellido, c.segundoApellido].filter(Boolean).join(' ')
const dateLabel = (value: string) => { const [year, month, day] = value.split('T')[0].split('-'); return year && month && day ? `${day}/${month}/${year}` : value }

function ClientePicker({ onSelect }: { onSelect: (cliente: Cliente) => void }) {
  const [open, setOpen] = useState(false); const [page, setPage] = useState<ClientePage | null>(null)
  const [buscar, setBuscar] = useState(''); const [debounced, setDebounced] = useState(''); const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const requestId = useRef(0)
  const openerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { const timer = window.setTimeout(() => { setDebounced(buscar.trim()); setPagina(1) }, 350); return () => window.clearTimeout(timer) }, [buscar])
  const load = useCallback(async () => {
    const id = ++requestId.current; setLoading(true); setError('')
    const filters: ClienteFilters = { pagina, limite: 10 }; if (debounced) filters.buscar = debounced
    try { const result = await listarClientes(clienteRepository, filters); if (id !== requestId.current) return; setPage(result) }
    catch (cause) { if (id === requestId.current) { setPage(null); setError(clienteErrorMessage(cause)) } }
    finally { if (id === requestId.current) setLoading(false) }
  }, [debounced, pagina])
  useEffect(() => { if (open) void load() }, [load, open])

  useEffect(() => {
    if (!open) return
    const dialog = document.querySelector<HTMLElement>('.cliente-selector-modal')
    if (!dialog) return
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(element => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true')
    const first = dialog.querySelector<HTMLElement>('input, select, textarea') ?? dialog.querySelector<HTMLElement>('button')
    first?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return }
      if (event.key !== 'Tab') return
      const elements = focusable()
      if (!elements.length) { event.preventDefault(); dialog.focus(); return }
      const index = elements.indexOf(document.activeElement as HTMLElement)
      if (index === -1) { event.preventDefault(); elements[0].focus() }
      else if (event.shiftKey && index === 0) { event.preventDefault(); elements[elements.length - 1].focus() }
      else if (!event.shiftKey && index === elements.length - 1) { event.preventDefault(); elements[0].focus() }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => { document.removeEventListener('keydown', handleKeyDown, true); openerRef.current?.focus() }
  }, [open])

  const close = () => setOpen(false)
  return <>
    <button type="button" className="secondary-button" ref={openerRef} onClick={() => { openerRef.current = document.activeElement instanceof HTMLButtonElement ? document.activeElement : openerRef.current; setOpen(true) }}><Search size={16} /> Buscar cliente</button>
    {open && <div className="cliente-selector-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}>
      <div className="cliente-selector-modal" role="dialog" aria-modal="true" aria-labelledby="analisis-selector-title" tabIndex={-1}>
        <div className="cliente-selector-header"><h2 id="analisis-selector-title">Seleccionar cliente</h2><button type="button" className="table-action" onClick={close} aria-label="Cerrar selector de cliente"><X size={19} /></button></div>
        <label className="analisis-client-search">Nombre o identificación<input value={buscar} placeholder="Buscar por nombre o identificación" onChange={(event) => setBuscar(event.target.value)} /></label>
        {loading && <div className="state-box" role="status">Cargando clientes...</div>}
        {!loading && error && <div className="cliente-selector-error" role="alert"><p>{error}</p><button type="button" className="secondary-button" onClick={() => void load()}>Reintentar</button></div>}
        {!loading && !error && page && <div className="table-wrap cliente-selector-table-wrap"><table className="cliente-selector-table"><thead><tr><th>Identificación</th><th>Nombre</th><th>Teléfono</th><th>Acción</th></tr></thead><tbody>{page.datos.map((cliente) => <tr key={cliente.id}><td>{cliente.identificacion}</td><td>{nombreCliente(cliente)}</td><td>{cliente.telefono1}</td><td><button type="button" className="primary-button" onClick={() => { onSelect(cliente); close() }}>Seleccionar</button></td></tr>)}</tbody></table>{!page.datos.length && <p className="form-note">No hay clientes para mostrar.</p>}</div>}
        {!loading && !error && page && <div className="cliente-selector-pagination"><button type="button" className="table-action" aria-label="Página anterior" disabled={pagina <= 1 || loading} onClick={() => setPagina((value) => value - 1)}><ChevronLeft size={16} /></button><span>Página {pagina} de {Math.max(page.totalPaginas, 1)} · {page.total} clientes</span><button type="button" className="table-action" aria-label="Página siguiente" disabled={pagina >= page.totalPaginas || loading} onClick={() => setPagina((value) => value + 1)}><ChevronRight size={16} /></button></div>}
      </div>
    </div>}
  </>
}

const indicatorLabels: Array<[keyof AnalisisFinancieroResponse['resumen'], string]> = [['totalPrestado', 'Total prestado'], ['totalPagado', 'Total pagado'], ['pendiente', 'Pendiente'], ['ganancia', 'Ganancia cobrada'], ['cantidadPrestamos', 'Préstamos']]
const detailItems = (p: AnalisisFinancieroPrestamo) => [['Capital pagado', formatCRC(p.capitalPagado)], ['Interés pagado', formatCRC(p.interesPagado)], ['Capital pendiente', formatCRC(p.capitalPendiente)], ['Interés pendiente', formatCRC(p.interesPendiente)], ['Monto total', formatCRC(p.montoTotal)]]
const estadoClass = (value: string) => `prestamo-status prestamo-status-${value.toLowerCase()}`
const cobranzaClass = (value: string) => `cobranza-badge cobranza-${value.toLowerCase()}`
const cobranzaLabel = (value: string) => value === 'AL_DIA' ? 'Al día' : value === 'ATRASADO' ? 'Atrasado' : value === 'PLAZO_CUMPLIDO' ? 'Plazo cumplido' : 'Saldado'

export function AnalisisFinancieroClientePage() {
  const [cliente, setCliente] = useState<Cliente | null>(null); const [analysis, setAnalysis] = useState<AnalisisFinancieroResponse | null>(null)
  const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [statementStates, setStatementStates] = useState<Record<number, { loading: boolean; error: boolean }>>({}); const requestId = useRef(0)
  const selectClient = (value: Cliente) => { const id = ++requestId.current; setCliente(value); setAnalysis(null); setError(''); setStatementStates({}); setLoading(true); void obtenerAnalisisFinanciero(clienteRepository, value.id).then((result) => { if (id === requestId.current) setAnalysis(result) }).catch(() => { if (id === requestId.current) setError('No se pudo cargar el análisis financiero del cliente.') }).finally(() => { if (id === requestId.current) setLoading(false) }) }
  const retry = () => { if (cliente) selectClient(cliente) }
  const statement = async (id: number) => { setStatementStates(current => ({ ...current, [id]: { loading: true, error: false } })); try { await abrirEstadoCuentaPdf(prestamoRepository, id); setStatementStates(current => ({ ...current, [id]: { loading: false, error: false } })) } catch { setStatementStates(current => ({ ...current, [id]: { loading: false, error: true } })) } }
  return <section className="analisis-financiero-page"><div className="page-heading"><div><p className="eyebrow">CLIENTES</p><h1>Análisis financiero del cliente</h1><p className="muted">Consultá el comportamiento financiero completo de un cliente.</p></div>{!cliente && <ClientePicker onSelect={selectClient} />}</div>
    {cliente && <div className="panel analisis-client-header"><div><h2>{nombreCliente(cliente)}</h2><p><strong>Identificación:</strong> {cliente.identificacion}</p></div><div className="analisis-contact"><span>Tel. principal: {cliente.telefono1}</span>{cliente.telefono2 && <span>Secundario: {cliente.telefono2}</span>}</div><button type="button" className="secondary-button" onClick={() => { setCliente(null); setAnalysis(null); setError(''); setStatementStates({}) }}>Cambiar cliente</button></div>}
    {loading && <div className="panel state-box" role="status">Cargando análisis financiero...</div>}
    {error && <div className="panel analisis-error" role="alert"><p>{error}</p><button type="button" className="primary-button" onClick={retry}>Reintentar</button></div>}
    {analysis && <><section className="analisis-summary"><h2>Resumen financiero</h2><div className="analisis-indicators" aria-label="Resumen financiero">{indicatorLabels.map(([key, label]) => <div className={`indicator-card${key === 'pendiente' ? ' indicator-card-pending' : ''}`} key={key}><span>{label}</span><strong>{key === 'cantidadPrestamos' ? analysis.resumen[key] : key === 'ganancia' ? formatCRC(analysis.resumen.ganancia) : formatCRC(analysis.resumen[key])}</strong></div>)}</div></section>{analysis.prestamos.length === 0 ? <div className="panel state-box analisis-empty">Este cliente no tiene préstamos registrados.</div> : <section className="analisis-loans-section"><h2>Préstamos</h2><div className="analisis-loans">{analysis.prestamos.map((p) => { const statementState = statementStates[p.id] ?? { loading: false, error: false }; return <article className="panel analisis-loan" key={p.id}><div className="analisis-loan-top"><div><p className="eyebrow">PRÉSTAMO #{p.id}</p><h3>Préstamo #{p.id}</h3><div className="analisis-badges"><span className={estadoClass(p.estado)}>{p.estado}</span><span className={cobranzaClass(p.indicadorCobranza)}>{cobranzaLabel(p.indicadorCobranza)}</span></div></div><div className="analisis-statement-action"><button type="button" className="secondary-button" disabled={statementState.loading} onClick={() => void statement(p.id)}><Printer size={15} /> {statementState.loading ? 'Generando...' : statementState.error ? 'Reintentar' : 'Estado de cuenta'}</button>{statementState.error && <p className="form-error" role="alert">No se pudo generar el estado de cuenta.</p>}</div></div><div className="analisis-loan-grid"><div><span>Fecha de alta</span><strong>{dateLabel(p.fechaAlta)}</strong></div><div><span>Fecha límite</span><strong>{dateLabel(p.fechaLimiteContractual)}</strong></div><div><span>Capital</span><strong>{formatCRC(p.capital)}</strong></div><div><span>Interés</span><strong>{formatCRC(p.interes)}</strong></div><div><span>Total pagado</span><strong>{formatCRC(p.totalPagado)}</strong></div><div><span>Ganancia</span><strong>{formatCRC(p.interesPagado)}</strong></div><div><span>Pendiente</span><strong>{formatCRC(p.saldoPendiente)}</strong></div><div><span>Duración</span><strong>{p.duracionDias} días ({p.tipoDuracion === 'FINALIZADO' ? 'finalizado' : 'transcurridos'})</strong></div><div><span>Último pago</span><strong>{p.ultimoPago ? `${dateLabel(p.ultimoPago.fecha)} · ${formatCRC(p.ultimoPago.monto)}` : 'Sin pagos registrados'}</strong></div></div><div className="analisis-secondary-metrics">{detailItems(p).map(([label, value]) => <span key={label}><small>{label}</small><b>{value}</b></span>)}</div></article> })}</div></section>}</>}
  </section>
}
