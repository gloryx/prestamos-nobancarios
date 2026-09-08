import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, FileText, Printer, WalletCards } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatCRC } from '@/shared/utils/currency'
import { abrirEstadoCuentaPdf, listarPlanPago, listarPrestamos } from '../application/prestamos.use-cases'
import { obtenerResumenDelPrestamo } from '../application/pagos.use-cases'
import { prestamoErrorMessage } from '../domain/prestamo.error'
import type { EstadoPrestamo, IndicadorCobranza, PlanPago, Prestamo, PrestamoFilters, PrestamoPage } from '../domain/prestamo.types'
import { AxiosPagoRepository } from '../infrastructure/axios-pago.repository'
import { AxiosPrestamoRepository } from '../infrastructure/axios-prestamo.repository'
import './seguimiento-cartera.css'

const prestamoRepository = new AxiosPrestamoRepository()
const pagoRepository = new AxiosPagoRepository()
const estadosIniciales: EstadoPrestamo[] = ['ACTIVO', 'INCOBRABLE']
const cobranzaOptions: Array<{ value: IndicadorCobranza | ''; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'AL_DIA', label: 'Al día' },
  { value: 'ATRASADO', label: 'Atrasado' },
  { value: 'PLAZO_CUMPLIDO', label: 'Plazo cumplido' },
]

function dateLabel(value: string | undefined) {
  if (!value) return '—'
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value
}

function cobranzaLabel(value: IndicadorCobranza) {
  return value === 'AL_DIA' ? 'Al día' : value === 'PLAZO_CUMPLIDO' ? 'Plazo cumplido' : value === 'ATRASADO' ? 'Atrasado' : 'Saldado'
}

function estadoClass(value: EstadoPrestamo) { return `prestamo-status prestamo-status-${value.toLowerCase()}` }
function cobranzaClass(value: IndicadorCobranza) { return `cobranza-badge cobranza-${value.toLowerCase()}` }
function Detail({ label, value, className = '' }: { label: string; value: string; className?: string }) { return <div className={`cartera-detail ${className}`.trim()}><span>{label}</span><strong>{value}</strong></div> }

export function SeguimientoCarteraPage() {
  const navigate = useNavigate()
  const [selectedEstados, setSelectedEstados] = useState<EstadoPrestamo[]>(estadosIniciales)
  const [indicadorCobranza, setIndicadorCobranza] = useState<IndicadorCobranza | ''>('')
  const [pagina, setPagina] = useState(1)
  const [page, setPage] = useState<PrestamoPage | null>(null)
  const [prestamo, setPrestamo] = useState<Prestamo | null>(null)
  const [plan, setPlan] = useState<PlanPago[]>([])
  const [capitalPendiente, setCapitalPendiente] = useState<number | null>(null)
  const [interesPendiente, setInteresPendiente] = useState<number | null>(null)
  const [saldoPendiente, setSaldoPendiente] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [detailError, setDetailError] = useState('')
  const listRequestId = useRef(0)
  const detailRequestId = useRef(0)
  const listController = useRef<AbortController | null>(null)
  const detailController = useRef<AbortController | null>(null)

  const loadList = useCallback(async () => {
    const requestId = ++listRequestId.current
    listController.current?.abort()
    listController.current = new AbortController()
    setLoading(true)
    setError('')
    setPrestamo(null)
    setPlan([])
    setCapitalPendiente(null)
    setInteresPendiente(null)
    setSaldoPendiente(null)
    try {
      const filters: PrestamoFilters = { pagina, limite: 1, estados: selectedEstados, ordenarPor: 'fechaAlta', direccionOrden: 'ASC' }
      if (indicadorCobranza) filters.indicadorCobranza = indicadorCobranza
      const result = await listarPrestamos(prestamoRepository, filters)
      if (requestId !== listRequestId.current) return
      const totalPaginas = Math.max(0, result.totalPaginas)
      const paginaSegura = totalPaginas === 0 ? 1 : Math.min(Math.max(1, result.pagina), totalPaginas)
      if (paginaSegura !== pagina) setPagina(paginaSegura)
      setPage({ ...result, pagina: paginaSegura })
    } catch (cause: unknown) {
      if (requestId === listRequestId.current) { setPage(null); setError(prestamoErrorMessage(cause)) }
    } finally {
      if (requestId === listRequestId.current) setLoading(false)
    }
  }, [indicadorCobranza, pagina, selectedEstados])

  useEffect(() => { void loadList(); return () => { listController.current?.abort(); listRequestId.current += 1 } }, [loadList])

  useEffect(() => {
    const current = page?.datos[0] ?? null
    if (!current) { detailController.current?.abort(); setPrestamo(null); setPlan([]); setCapitalPendiente(null); setInteresPendiente(null); setSaldoPendiente(null); return }
    const requestId = ++detailRequestId.current
    detailController.current?.abort()
    detailController.current = new AbortController()
    setDetailLoading(true)
    setDetailError('')
    setPrestamo(current)
    setPlan([])
    setCapitalPendiente(null)
    setInteresPendiente(null)
    setSaldoPendiente(null)
    void Promise.all([listarPlanPago(prestamoRepository, current.id), obtenerResumenDelPrestamo(pagoRepository, current.id)])
      .then(([nextPlan, summary]) => { if (requestId === detailRequestId.current) { setPlan(nextPlan); setCapitalPendiente(summary.capitalPendiente); setInteresPendiente(summary.interesPendiente); setSaldoPendiente(summary.saldoPendiente) } })
      .catch((cause: unknown) => { if (requestId === detailRequestId.current) setDetailError(prestamoErrorMessage(cause)) })
      .finally(() => { if (requestId === detailRequestId.current) setDetailLoading(false) })
    return () => { detailController.current?.abort(); detailRequestId.current += 1 }
  }, [page])

  const total = page?.total ?? 0
  const totalPaginas = page?.totalPaginas ?? 0
  const sinResultados = !loading && !error && total === 0
  const canGoBack = pagina > 1
  const canGoForward = totalPaginas > 0 && pagina < totalPaginas

  return <section className="seguimiento-cartera-page">
    <div className="page-heading"><div><p className="eyebrow">PRÉSTAMOS</p><h1>Seguimiento de cartera</h1><p className="muted">Consulta operativa de préstamos pendientes.</p></div></div>
    <div className="cartera-operation-zone">
      <div className="cartera-filters" aria-label="Filtros de préstamos">
        <p className="cartera-zone-label">Filtros</p>
        <div className="cartera-filter-fields">
          <label>Estado<select value={selectedEstados.length === 2 ? 'TODOS' : selectedEstados[0] ?? ''} onChange={event => { const value = event.target.value; setSelectedEstados(value === 'TODOS' ? estadosIniciales : [value as EstadoPrestamo]); setPagina(1) }}><option value="TODOS">Todos</option><option value="ACTIVO">Activo</option><option value="INCOBRABLE">Incobrable</option></select></label>
          <label>Cobranza<select value={indicadorCobranza} onChange={event => { setIndicadorCobranza(event.target.value as IndicadorCobranza | ''); setPagina(1) }}>{cobranzaOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        </div>
      </div>
      <div className="cartera-navigation" aria-label="Navegación de préstamos"><span className="cartera-zone-label">Navegación</span><div className="cartera-navigation-controls"><button type="button" onClick={() => setPagina(1)} disabled={loading || !canGoBack} aria-label="Primero">« Primero</button><button type="button" onClick={() => setPagina(value => Math.max(1, value - 1))} disabled={loading || !canGoBack} aria-label="Anterior"><ChevronLeft size={15} /> Anterior</button><span className="cartera-counter">Préstamo {total ? pagina : 0} de {total}</span><button type="button" onClick={() => setPagina(value => value + 1)} disabled={loading || !canGoForward} aria-label="Siguiente">Siguiente <ChevronRight size={15} /></button><button type="button" onClick={() => setPagina(totalPaginas)} disabled={loading || !canGoForward} aria-label="Último">Último »</button></div></div>
    </div>
    {error && <div className="cartera-state cartera-error" role="alert"><span>{error}</span><button className="secondary-button" type="button" onClick={() => void loadList()}>Reintentar</button></div>}
    {sinResultados && <p className="cartera-empty" role="status">No hay préstamos que coincidan con los filtros seleccionados.</p>}
    {!sinResultados && <>
       <div className="panel cartera-loan-panel">{loading ? <p className="cartera-loading" role="status">Cargando préstamo...</p> : prestamo && <><div className="cartera-loan-header"><div><p className="eyebrow">PRÉSTAMO #{prestamo.id}</p><h2>{prestamo.cliente.nombreCompleto}</h2><p className="cartera-identification">{prestamo.cliente.identificacion}</p></div><div className="cartera-loan-badges"><span className={estadoClass(prestamo.estado)}>{prestamo.estado}</span><span className={cobranzaClass(prestamo.indicadorCobranza)}>{cobranzaLabel(prestamo.indicadorCobranza)}</span></div></div><div className="cartera-details"><Detail label="Fecha de alta" value={dateLabel(prestamo.fechaAlta)} /><Detail label="Fecha límite contractual" value={dateLabel(prestamo.fechaLimiteContractual)} /><Detail className="cartera-detail-subdued" label="Capital original" value={formatCRC(prestamo.capital)} /><Detail className="cartera-detail-subdued" label="Interés original" value={formatCRC(prestamo.interes)} /><Detail className="cartera-detail-secondary" label="Capital pendiente" value={capitalPendiente === null ? '—' : formatCRC(capitalPendiente)} /><Detail className="cartera-detail-secondary" label="Interés pendiente" value={interesPendiente === null ? '—' : formatCRC(interesPendiente)} /><Detail className="cartera-detail-primary" label="Saldo pendiente" value={saldoPendiente === null ? '—' : formatCRC(saldoPendiente)} /><div className="cartera-detail-actions"><button className="secondary-button" type="button" onClick={() => void abrirEstadoCuentaPdf(prestamoRepository, prestamo.id)}><Printer size={15} /> Estado de cuenta</button>{prestamo.estado === 'ACTIVO' && <button className="primary-button" type="button" onClick={() => navigate('/pagos/registrar', { state: { prestamoId: prestamo.id } })}><WalletCards size={15} /> Registrar pago</button>}</div></div></> }</div>
      <div className="panel cartera-plan-panel"><div className="cartera-section-heading"><h2>Plan de pagos</h2><FileText size={18} aria-hidden="true" /></div>{detailLoading ? <p className="cartera-loading" role="status">Cargando plan y saldo...</p> : detailError ? <p className="cartera-error" role="alert">{detailError}</p> : <div className="table-wrap"><table className="cartera-plan-table"><thead><tr><th>N°</th><th>Fecha</th><th>Cuota</th><th>Pagado</th><th>Pendiente</th><th>Estado</th></tr></thead><tbody>{plan.map(item => <tr key={item.id}><td>{item.numeroPago}</td><td>{dateLabel(item.fechaVencimiento)}</td><td>{formatCRC(item.montoProgramado)}</td><td>{formatCRC(item.montoPagado)}</td><td>{formatCRC(item.montoPendiente)}</td><td><span className={`cartera-installment-status cartera-installment-${item.estado.toLowerCase()}`}>{item.estado}</span></td></tr>)}</tbody></table></div>}</div>
    </>}
  </section>
}
