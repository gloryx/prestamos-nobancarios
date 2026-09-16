import { useEffect, useRef, useState } from 'react'
import { BarChart3, FileDown, Search, Users } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AxiosDesempenoCobradoresRepository } from '../infrastructure/axios-desempeno-cobradores.repository'
import { obtenerDesempenoCobradores } from '../application/desempeno-cobradores.use-case'
import type { DesempenoCobradoresReport } from '../domain/desempeno-cobradores.types'
import { AxiosUsuarioRepository } from '@/features/usuarios/infrastructure/axios-usuario.repository'
import type { UsuarioSelector } from '@/features/usuarios/domain/usuario.types'
import { AxiosFormaPagoRepository } from '@/features/formas-pago/infrastructure/axios-forma-pago.repository'
import type { FormaPago } from '@/features/formas-pago/domain/forma-pago.types'
import { formatCRC } from '@/shared/utils/currency'
import { formatDateOnly, isValidDateOnly, todayInCostaRica } from '@/shared/utils/date'
import './desempeno-cobradores.css'

const reportRepository = new AxiosDesempenoCobradoresRepository()
const usuarioRepository = new AxiosUsuarioRepository()
const formaRepository = new AxiosFormaPagoRepository()
const today = todayInCostaRica()
const initialFrom = `${today.slice(0, 8)}01`
const finite = (value: number) => Number.isFinite(value) ? value : 0
const money = (value: number) => formatCRC(finite(value))
const count = (value: number) => finite(value).toLocaleString('es-CR')
const colors = ['#276678', '#2a9d8f', '#e9a227', '#c85c5c', '#7b61a8', '#6a994e']
type Filters = { fechaDesde: string; fechaHasta: string; cobradorId: string; formaPagoId: string }
type Metric = 'montoRecibido' | 'cantidadPagos' | 'capitalAplicado' | 'interesAplicado'

export function DesempenoCobradoresPage() {
  const [filters, setFilters] = useState<Filters>({ fechaDesde: initialFrom, fechaHasta: today, cobradorId: '', formaPagoId: '' })
  const [appliedFilters, setAppliedFilters] = useState<Filters>({ fechaDesde: initialFrom, fechaHasta: today, cobradorId: '', formaPagoId: '' })
  const [report, setReport] = useState<DesempenoCobradoresReport | null>(null)
  const [collectors, setCollectors] = useState<UsuarioSelector[]>([])
  const [paymentMethods, setPaymentMethods] = useState<FormaPago[]>([])
  const [loading, setLoading] = useState(false)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [error, setError] = useState('')
  const [exportError, setExportError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  const [metric, setMetric] = useState<Metric>('montoRecibido')
  const sequence = useRef(0)

  useEffect(() => { void Promise.all([usuarioRepository.listSelector(), formaRepository.list()]).then(([users, methods]) => { setCollectors(users); setPaymentMethods(methods.filter((item) => item.activo)) }).catch(() => setCatalogError('No se pudieron cargar los filtros.')).finally(() => setCatalogLoading(false)) }, [])
  const update = (field: keyof Filters, value: string) => setFilters((current) => ({ ...current, [field]: value }))
  const consult = async () => {
    if (!isValidDateOnly(filters.fechaDesde) || !isValidDateOnly(filters.fechaHasta)) { setError('Ingresa fechas válidas.'); return }
    if (filters.fechaDesde > filters.fechaHasta) { setError('La fecha inicial no puede ser posterior a la fecha final.'); return }
    const request = ++sequence.current; setLoading(true); setError('')
    try { const result = await obtenerDesempenoCobradores(reportRepository, { fechaDesde: filters.fechaDesde, fechaHasta: filters.fechaHasta, ...(filters.cobradorId ? { cobradorId: Number(filters.cobradorId) } : {}), ...(filters.formaPagoId ? { formaPagoId: Number(filters.formaPagoId) } : {}) }); if (request === sequence.current) { setReport(result); setAppliedFilters(filters) } } catch { if (request === sequence.current) { setReport(null); setError('No se pudo cargar el desempeño de cobradores.') } } finally { if (request === sequence.current) setLoading(false) }
  }
  const clear = () => { const empty = { fechaDesde: initialFrom, fechaHasta: today, cobradorId: '', formaPagoId: '' }; setFilters(empty); setAppliedFilters(empty); setReport(null); setError(''); setExportError('') }
  const exportPdf = async () => { if (!report?.cobradores.length || exporting) return; setExporting(true); setExportError(''); try { const params = { fechaDesde: appliedFilters.fechaDesde, fechaHasta: appliedFilters.fechaHasta, ...(appliedFilters.cobradorId ? { cobradorId: Number(appliedFilters.cobradorId) } : {}), ...(appliedFilters.formaPagoId ? { formaPagoId: Number(appliedFilters.formaPagoId) } : {}) }; const { blob, filename } = await reportRepository.exportPdf(params); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url) } catch { setExportError('No se pudo generar el PDF del desempeño de cobradores.') } finally { setExporting(false) } }
  return <section className="collector-report-page"><div className="page-heading"><div><p className="eyebrow">REPORTES / PAGOS</p><h1><BarChart3 size={25} aria-hidden="true" /> Desempeño de cobradores</h1><p className="muted">Descripción de pagos registrados por cobrador y fecha de pago.</p></div></div><div className="panel collector-report-filters"><label>Desde<input type="date" value={filters.fechaDesde} onChange={(event) => update('fechaDesde', event.target.value)} /></label><label>Hasta<input type="date" value={filters.fechaHasta} onChange={(event) => update('fechaHasta', event.target.value)} /></label><label>Cobrador<select value={filters.cobradorId} onChange={(event) => update('cobradorId', event.target.value)} disabled={catalogLoading}><option value="">Todos</option>{collectors.map((item) => <option key={item.id} value={item.id}>{item.nombreCompleto}</option>)}</select></label><label>Forma de pago<select value={filters.formaPagoId} onChange={(event) => update('formaPagoId', event.target.value)} disabled={catalogLoading}><option value="">Todas</option>{paymentMethods.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label><div className="collector-report-actions"><button className="primary-button" type="button" onClick={() => void consult()} disabled={loading || exporting}><Search size={16} /> {loading ? 'Consultando…' : 'Consultar'}</button><button className="secondary-button" type="button" onClick={clear} disabled={loading || exporting}>Limpiar</button><button className="secondary-button" type="button" onClick={() => void exportPdf()} disabled={loading || exporting || !report?.cobradores.length}><FileDown size={16} /> {exporting ? 'Generando PDF…' : 'Exportar PDF'}</button></div></div>{catalogError && <p className="form-error" role="alert">{catalogError}</p>}{error && <p className="form-error" role="alert">{error}</p>}{exportError && <p className="form-error" role="alert">{exportError}</p>}{!report && !loading && !error && <div className="panel state-box">Selecciona los filtros y pulsa Consultar.</div>}{loading && <div className="panel state-box" role="status">Cargando desempeño de cobradores…</div>}{report && !loading && <ReportContent report={report} metric={metric} setMetric={setMetric} />}</section>
}

function ReportContent({ report, metric, setMetric }: { report: DesempenoCobradoresReport; metric: Metric; setMetric: (value: Metric) => void }) {
  const rows = report.cobradores
  const metricNames: Record<Metric, string> = { montoRecibido: 'Monto recibido', cantidadPagos: 'Cantidad de pagos', capitalAplicado: 'Capital aplicado', interesAplicado: 'Interés aplicado' }
  return <><div className="collector-report-cards">{[['Pagos', count(report.totales.cantidadPagos)], ['Total recibido', money(report.totales.totalRecibido)], ['Capital aplicado', money(report.totales.capitalAplicado)], ['Interés aplicado', money(report.totales.interesAplicado)]].map(([label, value]) => <div className="panel collector-report-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>{rows.length === 0 ? <div className="panel state-box" role="status">No hay pagos registrados para los filtros seleccionados.</div> : <><section className="collector-report-charts"><div className="panel collector-chart"><div className="collector-section-heading"><h2>Pagos por cobrador</h2><select aria-label="Métrica del gráfico" value={metric} onChange={(event) => setMetric(event.target.value as Metric)}>{Object.entries(metricNames).map(([key, label]) => <option key={key} value={key}>{label.replace(' de pagos', '')}</option>)}</select></div><div className="collector-chart-canvas"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="cobradorNombre" /><YAxis tickFormatter={(value) => metric === 'cantidadPagos' ? count(Number(value)) : money(Number(value))} /><Tooltip formatter={(value) => metric === 'cantidadPagos' ? count(Number(value ?? 0)) : money(Number(value ?? 0))} /><Bar dataKey={metric} name={metricNames[metric]} fill="#276678" /></BarChart></ResponsiveContainer></div></div><div className="panel collector-chart"><h2>Participación del monto recibido</h2><div className="collector-chart-canvas"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={rows} dataKey="montoRecibido" nameKey="cobradorNombre" cx="50%" cy="50%" outerRadius="75%" label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`}>{rows.map((row, index) => <Cell key={`${row.cobradorId ?? 'none'}-${index}`} fill={colors[index % colors.length]} />)}</Pie><Tooltip formatter={(value) => money(Number(value ?? 0))} /><Legend /></PieChart></ResponsiveContainer></div></div></section><section className="panel collector-table-panel"><div className="collector-section-heading"><div><h2>Comparativo por cobrador</h2><p className="muted">Período: {formatDateOnly(report.fechaDesde)} al {formatDateOnly(report.fechaHasta)}</p></div><Users size={20} aria-hidden="true" /></div><div className="table-wrap"><table><caption>Comparativo descriptivo por cobrador</caption><thead><tr><th scope="col">Cobrador</th><th scope="col">Pagos</th><th scope="col">Clientes</th><th scope="col">Préstamos</th><th scope="col">Total recibido</th><th scope="col">Capital</th><th scope="col">Interés</th><th scope="col">Promedio/pago</th><th scope="col">Participación</th></tr></thead><tbody>{rows.map((row) => <tr key={row.cobradorId ?? 'sin-cobrador'}><th scope="row">{row.cobradorNombre}</th><td>{count(row.cantidadPagos)}</td><td>{count(row.cantidadClientes)}</td><td>{count(row.cantidadPrestamos)}</td><td>{money(row.montoRecibido)}</td><td>{money(row.capitalAplicado)}</td><td>{money(row.interesAplicado)}</td><td>{money(row.promedioPorPago)}</td><td>{finite(row.participacionMonto).toFixed(2)}%</td></tr>)}</tbody></table></div></section></>}</>
}
