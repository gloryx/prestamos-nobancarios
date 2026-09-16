import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3, CalendarDays, CircleAlert, CircleCheck, Coins, HandCoins, RefreshCw, TrendingUp, Wallet, type LucideIcon } from 'lucide-react'
import { formatCRC } from '@/shared/utils/currency'
import { obtenerFlujoPrestamos } from '../application/flujo-prestamos.use-cases'
import type { FlujoMes, FlujoPrestamosReport, FlujoTotal } from '../domain/flujo-prestamos.types'
import { AxiosFlujoPrestamosRepository } from '../infrastructure/axios-flujo-prestamos.repository'
import './flujo-prestamos.css'

const repository = new AxiosFlujoPrestamosRepository()
const currentYear = new Date().getFullYear()
const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const emptyTotal: FlujoTotal = { capitalColocado: 0, pagosRecibidos: 0, capitalRecuperado: 0, gananciaRealizada: 0, flujoNeto: 0, diferenciaConciliacion: 0, estadoDatos: 'OK', porcentajeCapitalPagos: null, porcentajeInteresPagos: null }
const money = (value: number) => formatCRC(value)
const signedMoney = (value: number) => value === 0 ? money(value) : `${value > 0 ? '+' : ''}${money(value)}`
const compactMoney = (value: number) => {
  const absolute = Math.abs(value)
  if (absolute >= 1_000_000) return `₡${(value / 1_000_000).toLocaleString('es-CR', { maximumFractionDigits: 1 })} M`
  if (absolute >= 1_000) return `₡${(value / 1_000).toLocaleString('es-CR', { maximumFractionDigits: 0 })} mil`
  return `₡${value.toLocaleString('es-CR', { maximumFractionDigits: 0 })}`
}

export function FlujoPrestamosPage() {
  const [year, setYear] = useState(String(currentYear))
  const [compare, setCompare] = useState(false)
  const [from, setFrom] = useState(String(currentYear - 1))
  const [to, setTo] = useState(String(currentYear))
  const [report, setReport] = useState<FlujoPrestamosReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const requestId = useRef(0)
  const periodError = compare && (!/^\d{4}$/.test(from) || !/^\d{4}$/.test(to) || Number(from) > Number(to))
    ? 'El año Desde debe ser menor o igual que el año Hasta.'
    : ''
  const desde = compare ? `${from}-01` : `${year}-01`
  const hasta = compare ? `${to}-12` : `${year}-12`

  useEffect(() => {
    const id = ++requestId.current
    if (periodError) {
      setReport(null)
      setError(periodError)
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    void obtenerFlujoPrestamos(repository, desde, hasta).then((value) => {
      if (id === requestId.current) setReport(value)
    }).catch(() => {
      if (id === requestId.current) { setReport(null); setError('No se pudo cargar el flujo histórico.') }
    }).finally(() => { if (id === requestId.current) setLoading(false) })
  }, [desde, hasta, periodError, retryCount])

  const selectedRows = useMemo(() => report?.meses.filter((row) => compare || row.anio === Number(year)) ?? [], [report, compare, year])
  const selectedTotal = compare ? (report?.total ?? emptyTotal) : (report?.anuales[year] ?? emptyTotal)
  const warningMonths = selectedRows.filter((row) => row.estadoDatos === 'ADVERTENCIA')
  const hasMovement = selectedRows.some((row) => row.pagosRecibidos !== 0 || row.capitalColocado !== 0)
  const annualRows = useMemo(() => report ? Object.entries(report.anuales).map(([anio, values]) => ({ etiqueta: anio, ...values })) : [], [report])
  const retry = () => setRetryCount((value) => value + 1)

  return <main className="flujo-report-page">
    <div className="page-heading"><div><p className="eyebrow">FINANZAS / REPORTES</p><h1><BarChart3 size={25} aria-hidden="true" /> Flujo histórico de préstamos</h1><p className="muted">Flujo real de efectivo por mes, basado en Caja y pagos registrados.</p></div></div>
    <div className="panel flujo-toolbar">
      <div className="flujo-mode" role="group" aria-label="Modo del reporte">
        <button type="button" aria-pressed={!compare} className={!compare ? 'active' : ''} onClick={() => setCompare(false)}>Resumen anual</button>
        <button type="button" aria-pressed={compare} className={compare ? 'active' : ''} onClick={() => setCompare(true)}>Comparar años</button>
      </div>
      {!compare ? <label><CalendarDays size={16} aria-hidden="true" /> Año<select aria-label="Año del resumen" value={year} onChange={(e) => setYear(e.target.value)}>{[currentYear - 4, currentYear - 3, currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((value) => <option key={value}>{value}</option>)}</select></label> : <div className="flujo-range"><label>Desde <input aria-label="Año inicial" type="number" min="2000" max="2100" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label>Hasta <input aria-label="Año final" type="number" min="2000" max="2100" value={to} onChange={(e) => setTo(e.target.value)} /></label></div>}
    </div>
    {loading && <div className="panel state-box flujo-loading" role="status" aria-live="polite"><RefreshCw size={16} aria-hidden="true" /> Cargando reporte...</div>}
    {!loading && error && <div className="panel state-box flujo-error" role="alert">{error}{!periodError && <button type="button" className="secondary-button" onClick={retry}><RefreshCw size={15} aria-hidden="true" /> Reintentar</button>}</div>}
    {!loading && !error && report && <>
      <section className={`flujo-status panel ${warningMonths.length > 0 ? 'flujo-status-warning' : 'flujo-status-ok'}`} role="status" aria-live="polite">{warningMonths.length === 0 ? <><CircleCheck size={17} aria-hidden="true" /> Conciliación correcta</> : <><CircleAlert size={17} aria-hidden="true" /> <span>Conciliación con diferencias en: <strong>{warningMonths.map((row) => row.periodo).join(', ')}</strong></span></>}</section>
      {!compare && <><section className="flujo-metrics">{([['Capital colocado', selectedTotal.capitalColocado, Coins], ['Pagos recibidos', selectedTotal.pagosRecibidos, HandCoins], ['Capital recuperado', selectedTotal.capitalRecuperado, Wallet], ['Ganancia realizada', selectedTotal.gananciaRealizada, TrendingUp], ['Flujo neto de efectivo', selectedTotal.flujoNeto, BarChart3]] as Array<[string, number, LucideIcon]>).map(([label, value, Icon]) => <div className="panel flujo-metric" key={label}><span><Icon size={18} aria-hidden="true" /></span><small>{label}</small><strong>{label === 'Flujo neto de efectivo' ? signedMoney(value) : money(value)}</strong></div>)}</section><p className="flujo-explanation">Pagos recibidos menos dinero nuevo desembolsado. No representa utilidad.</p><Composition total={selectedTotal} /></>}
      {!hasMovement && <p className="flujo-empty-period">No hay movimientos para el período seleccionado</p>}
      <section className="flujo-charts">{compare ? <><Chart title="Capital colocado vs pagos recibidos por año" data={annualRows} lines={[['capitalColocado', 'Capital colocado', '#276678'], ['pagosRecibidos', 'Pagos recibidos', '#2a9d8f']]} /><Chart title="Ganancia realizada por año" data={annualRows} lines={[['gananciaRealizada', 'Ganancia realizada', '#e9a227']]} /></> : <><Chart title="Capital colocado vs pagos" data={selectedRows} lines={[['capitalColocado', 'Capital colocado', '#276678'], ['pagosRecibidos', 'Pagos recibidos', '#2a9d8f']]} /><Chart title="Ganancia realizada" data={selectedRows} lines={[['gananciaRealizada', 'Ganancia realizada', '#e9a227']]} /></>}</section>
       <section className="panel flujo-table-panel"><h2>{compare ? 'Resumen comparativo' : `Detalle mensual ${year}`}</h2>{compare ? <AnnualTable report={report} /> : <MonthlyTable rows={selectedRows} total={selectedTotal} />}</section>
    </>}
  </main>
}

function Composition({ total }: { total: FlujoTotal }) {
  const derivePercentage = (amount: number, denominator: number): number | null => denominator === 0 ? null : amount / denominator * 100
  if (total.pagosRecibidos === 0) return <section className="panel flujo-composition"><h2>Composición de pagos recibidos</h2><p>Sin pagos registrados</p></section>
  const items = [['Capital recuperado', total.capitalRecuperado, total.porcentajeCapitalPagos ?? derivePercentage(total.capitalRecuperado, total.pagosRecibidos)], ['Interés cobrado', total.gananciaRealizada, total.porcentajeInteresPagos ?? derivePercentage(total.gananciaRealizada, total.pagosRecibidos)]] as Array<[string, number, number | null]>
  return <section className="panel flujo-composition"><h2>Composición de pagos recibidos</h2>{items.map(([label, value, percentage]) => <div className="composition-item" key={label}><div><span>{label}</span><strong>{money(value)}</strong></div>{percentage !== null && <div className="composition-bar" aria-label={`${label}: ${percentage}%`}><span style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }} /><small>{percentage.toLocaleString('es-CR', { maximumFractionDigits: 1 })}%</small></div>}</div>)}</section>
}

type FlowAmountKey = 'capitalColocado' | 'pagosRecibidos' | 'capitalRecuperado' | 'gananciaRealizada' | 'flujoNeto'
type ChartRow = Partial<FlujoMes> & { etiqueta?: string }
function Chart({ title, data, lines }: { title: string; data: ChartRow[]; lines: Array<[FlowAmountKey, string, string]> }) {
  const descriptionId = useId()
  const chartData = data.map((row) => ({ ...row, etiqueta: row.etiqueta || monthNames[(row.mes ?? 1) - 1] }))
  const description = lines.map(([key, label]) => `${label}: ${chartData.map((row) => `${row.etiqueta} ${money(Number(row[key as keyof ChartRow] ?? 0))}`).join('; ')}`).join('. ')
  return <section className="panel flujo-chart" aria-labelledby={`${descriptionId}-title`}><h2 id={`${descriptionId}-title`}>{title}</h2><p id={descriptionId} className="visually-hidden">{description || 'Sin datos para el período seleccionado.'}</p><div className="flujo-chart-canvas" role="img" aria-describedby={descriptionId}><ResponsiveContainer width="100%" height={270}><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="etiqueta" /><YAxis tickFormatter={(value) => compactMoney(Number(value))} /><Tooltip formatter={(value) => money(Number(value))} /><Legend />{lines.map(([key, label, color]) => <Line key={key} type="monotone" dataKey={key} name={label} stroke={color} strokeWidth={2} dot={false} />)}</LineChart></ResponsiveContainer></div></section>
}

const columns: Array<[string, FlowAmountKey]> = [['Capital colocado', 'capitalColocado'], ['Pagos recibidos', 'pagosRecibidos'], ['Capital recuperado', 'capitalRecuperado'], ['Ganancia realizada', 'gananciaRealizada'], ['Flujo neto', 'flujoNeto']]
function MonthlyTable({ rows, total }: { rows: FlujoMes[]; total: FlujoTotal }) { return <div className="table-wrap"><table><caption>Detalle mensual del flujo de préstamos</caption><thead><tr><th scope="col">Mes</th>{columns.map(([label]) => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.periodo}><th scope="row">{monthNames[row.mes - 1]}</th>{columns.map(([, key]) => <td key={key}>{key === 'flujoNeto' ? signedMoney(row[key]) : money(row[key])}</td>)}</tr>)}<tr className="flujo-total-row"><th scope="row">TOTAL</th>{columns.map(([, key]) => <th scope="col" key={key}>{key === 'flujoNeto' ? signedMoney(total[key]) : money(total[key])}</th>)}</tr></tbody></table></div> }
function AnnualTable({ report }: { report: FlujoPrestamosReport }) { return <div className="table-wrap"><table><caption>Resumen comparativo anual del flujo de préstamos</caption><thead><tr><th scope="col">Año</th>{columns.map(([label]) => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{Object.entries(report.anuales).map(([year, row]) => <tr key={year}><th scope="row">{year}</th>{columns.map(([, key]) => <td key={key}>{key === 'flujoNeto' ? signedMoney(row[key]) : money(row[key])}</td>)}</tr>)}<tr className="flujo-total-row"><th scope="row">TOTAL DEL PERÍODO</th>{columns.map(([, key]) => <th scope="col" key={key}>{key === 'flujoNeto' ? signedMoney(report.total[key]) : money(report.total[key])}</th>)}</tr></tbody></table></div> }
