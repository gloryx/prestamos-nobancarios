import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowRightLeft, Banknote, CalendarDays, ChartNoAxesCombined, FileDown, FileText, RefreshCw, Search, TrendingUp, UserRound, WalletCards, X } from 'lucide-react'
import type { Cliente } from '@/features/clientes/domain/cliente.types'
import { formatCRC } from '@/shared/utils/currency'
import { ClientePicker } from './ClientePicker'
import { obtenerReporteRefinanciamientos, refinanciamientoErrorMessage } from '../application/refinanciamientos.use-cases'
import { generarReporteRefinanciamientosPdf } from '../application/refinanciamientos-report-pdf'
import type { RefinanciamientoReportFilters, RefinanciamientoReportResponse } from '../domain/refinanciamiento.types'
import { AxiosRefinanciamientoRepository } from '../infrastructure/axios-refinanciamiento.repository'
import './refinanciamientos-reporte.css'

const repository = new AxiosRefinanciamientoRepository()
const dateLabel = (value: string) => value ? value.slice(0, 10).split('-').reverse().join('/') : '—'
const nombreCliente = (cliente: Cliente) => [cliente.primerNombre, cliente.segundoNombre, cliente.primerApellido, cliente.segundoApellido].filter(Boolean).join(' ')

export function RefinanciamientosReportePage() {
  const [report, setReport] = useState<RefinanciamientoReportResponse | null>(null)
  const [buscar, setBuscar] = useState('')
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [appliedFilters, setAppliedFilters] = useState<RefinanciamientoReportFilters>({})
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState('')
  const [pdfError, setPdfError] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)
  const requestId = useRef(0)

  const load = useCallback(async (filters: RefinanciamientoReportFilters) => {
    const id = ++requestId.current
    setLoading(true)
    setApiError('')
    setPdfError('')
    try {
      const result = await obtenerReporteRefinanciamientos(repository, filters)
      if (id === requestId.current) setReport(result)
    } catch (cause) {
      if (id === requestId.current) { setReport(null); setApiError(refinanciamientoErrorMessage(cause)) }
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => { void load({}) }, [load])

  const currentFilters = (): RefinanciamientoReportFilters => {
    const filters: RefinanciamientoReportFilters = {}
    if (buscar.trim()) filters.buscar = buscar.trim()
    if (cliente) filters.clienteId = cliente.id
    if (fechaDesde) filters.fechaDesde = fechaDesde
    if (fechaHasta) filters.fechaHasta = fechaHasta
    return filters
  }
  const applyFilters = () => {
    const filters = currentFilters()
    setPdfError('')
    setAppliedFilters(filters)
    void load(filters)
  }
  const clearFilters = () => {
    setBuscar(''); setCliente(null); setFechaDesde(''); setFechaHasta('')
    setPdfError('')
    setAppliedFilters({})
    void load({})
  }
  const exportPdf = () => {
    if (!report || !report.datos.length || pdfLoading) return
    setPdfLoading(true)
    setPdfError('')
    const appliedClientName = cliente && appliedFilters.clienteId === cliente.id ? nombreCliente(cliente) : undefined
    try { generarReporteRefinanciamientosPdf(report, { clienteNombre: appliedClientName, filtros: appliedFilters }) } catch { setPdfError('No se pudo generar el PDF.') } finally { setPdfLoading(false) }
  }
  const summary = report?.resumen
  const daysLabel = summary?.diasGanadosCompletos ? 'Promedio de días ganados' : 'Promedio de días conocidos'

  return <section className="refinanciamientos-report-page">
    <div className="page-heading refinanciamientos-report-heading">
      <div><p className="eyebrow">REFINANCIAMIENTOS</p><h1><ChartNoAxesCombined size={25} aria-hidden="true" /> Reporte de Refinanciamientos</h1><p className="muted">Análisis consolidado de las operaciones de refinanciamiento.</p></div>
      <button type="button" className="secondary-button" onClick={exportPdf} disabled={!report?.datos.length || pdfLoading} aria-label={pdfLoading ? 'Generando PDF' : 'Exportar reporte en PDF'}><FileDown size={16} aria-hidden="true" /> {pdfLoading ? 'Generando PDF...' : 'Exportar PDF'}</button>
    </div>
    <div className="panel refinanciamientos-report-filters">
      <label><span className="filter-label"><Search size={15} aria-hidden="true" /> Buscar</span><input placeholder="Cliente o número de préstamo" value={buscar} onChange={(event) => setBuscar(event.target.value)} /></label>
      <div className="refinanciamiento-report-client-filter"><span className="filter-label"><UserRound size={15} aria-hidden="true" /> Cliente</span>{cliente ? <div className="selected-report-client"><strong>{nombreCliente(cliente)}</strong><button type="button" className="table-action" title="Quitar cliente" aria-label="Quitar cliente" onClick={() => setCliente(null)}><X size={15} aria-hidden="true" /></button></div> : <ClientePicker onSelect={setCliente} />}</div>
      <label><span className="filter-label"><CalendarDays size={15} aria-hidden="true" /> Fecha desde</span><input type="date" value={fechaDesde} onChange={(event) => setFechaDesde(event.target.value)} /></label>
      <label><span className="filter-label"><CalendarDays size={15} aria-hidden="true" /> Fecha hasta</span><input type="date" value={fechaHasta} onChange={(event) => setFechaHasta(event.target.value)} /></label>
      <div className="report-filter-actions"><button type="button" className="primary-button" onClick={applyFilters}><Search size={15} aria-hidden="true" /> Aplicar filtros</button><button type="button" className="secondary-button" onClick={clearFilters}>Limpiar</button></div>
    </div>
    {loading && <div className="panel state-box" role="status">Cargando reporte...</div>}
     {!loading && apiError && <div className="panel refinanciamientos-report-error" role="alert"><span>No se pudo cargar el reporte de refinanciamientos.</span><button type="button" className="secondary-button" onClick={() => void load(appliedFilters)}><RefreshCw size={15} aria-hidden="true" /> Reintentar</button></div>}
     {!loading && !apiError && pdfError && <div className="panel refinanciamientos-report-error" role="alert"><span>{pdfError}</span><button type="button" className="secondary-button" onClick={exportPdf}><RefreshCw size={15} aria-hidden="true" /> Reintentar</button></div>}
     {!loading && !apiError && report && report.datos.length === 0 && <div className="panel state-box refinanciamientos-report-empty">No hay refinanciamientos que coincidan con los filtros seleccionados.</div>}
     {!loading && !apiError && report && <>
      <section className="report-section"><h2>Resumen financiero</h2><div className="report-summary-grid"><ReportMetric label="Refinanciamientos" value={summary?.cantidadRefinanciamientos} icon={<RefreshCw />} tone="blue" /><ReportMetric label="Clientes" value={summary?.cantidadClientes} icon={<UserRound />} tone="indigo" /><ReportMetric label="Capital trasladado" value={formatCRC(summary?.totalCapitalTrasladado ?? 0)} icon={<ArrowRightLeft />} tone="teal" /><ReportMetric label="Dinero nuevo entregado" value={formatCRC(summary?.totalDineroNuevoDesembolsado ?? 0)} icon={<Banknote />} tone="green" /><ReportMetric label="Capital nuevo" value={formatCRC(summary?.totalCapitalNuevo ?? 0)} icon={<WalletCards />} tone="blue" /><ReportMetric label="Interés nuevo pactado" value={formatCRC(summary?.totalInteresNuevoPactado ?? 0)} icon={<TrendingUp />} tone="amber" /></div></section>
      <section className="report-section"><h2>Indicadores de refinanciamiento</h2>{!summary?.diasGanadosCompletos && <p className="report-history-note" title="Los registros históricos carecen de información contractual para determinar todos los días ganados.">Los registros históricos carecen de información contractual para determinar todos los días ganados.</p>}<div className="report-indicators"><ReportMetric label="Con dinero nuevo" value={summary?.refinanciamientosConDineroNuevo} tone="green" /><ReportMetric label="Sin dinero nuevo" value={summary?.refinanciamientosSinDineroNuevo} tone="gray" /><ReportMetric label="Anticipados" value={summary?.refinanciamientosAnticipados} tone="indigo" /><ReportMetric label="Sin anticipación" value={summary?.refinanciamientosSinAnticipacion} tone="amber" /><ReportMetric label={daysLabel} value={summary?.promedioDiasGanados === null ? '—' : summary?.promedioDiasGanados} tone="blue" /></div></section>
       {report.datos.length > 0 && <section className="panel refinanciamientos-report-table-panel"><div className="report-table-heading"><div><h2>Detalle de operaciones</h2><p className="muted">Resultados completos según los filtros aplicados.</p></div><FileText size={19} aria-hidden="true" /></div><div className="table-wrap refinanciamientos-report-table-wrap"><table className="refinanciamientos-report-table"><caption>Detalle de operaciones de refinanciamiento</caption><thead><tr><th scope="col">Fecha</th><th scope="col">Cliente</th><th scope="col">Préstamo origen</th><th scope="col">Capital trasladado</th><th scope="col">Dinero nuevo</th><th scope="col">Capital nuevo</th><th scope="col">Interés nuevo</th><th scope="col">Días ganados</th><th scope="col">Préstamo nuevo</th></tr></thead><tbody>{report.datos.map((item) => <tr key={item.id}><td>{dateLabel(item.fecha)}</td><td className="report-client-cell">{item.cliente.nombreCompleto}</td><td><span className="report-loan-badge">#{item.prestamoOrigenId}</span></td><td className="report-money teal">{formatCRC(item.capitalTrasladado)}</td><td className="report-money green">{formatCRC(item.dineroNuevoDesembolsado)}</td><td className="report-money blue">{formatCRC(item.capitalNuevo)}</td><td className="report-money amber">{formatCRC(item.interesNuevo)}</td><td className="report-days">{item.diasGanados === null ? '—' : item.diasGanados}</td><td><span className="report-loan-badge muted-badge">#{item.prestamoNuevoId}</span></td></tr>)}</tbody></table></div></section>}
    </>}
  </section>
}

function ReportMetric({ label, value, icon, tone }: { label: string; value: string | number | undefined; icon?: ReactNode; tone: string }) {
  return <div className={`report-metric report-metric-${tone}`}>{icon && <span className="report-metric-icon" aria-hidden="true">{icon}</span>}<span>{label}</span><strong>{value ?? '—'}</strong></div>
}
