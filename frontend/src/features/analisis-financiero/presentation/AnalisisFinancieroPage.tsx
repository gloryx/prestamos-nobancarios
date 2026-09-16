import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { BarChart3, CalendarDays, RefreshCw } from 'lucide-react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCRC } from '@/shared/utils/currency'
import { obtenerComparativoAnual, obtenerResumenMensual } from '../application/analisis-financiero.use-cases'
import type { AnalisisFinancieroAnio, AnalisisFinancieroMes, ResumenMensualAnalisisFinanciero, ComparativoAnualAnalisisFinanciero } from '../domain/analisis-financiero.types'
import { AxiosAnalisisFinancieroRepository } from '../infrastructure/axios-analisis-financiero.repository'
import './analisis-financiero.css'

const repository = new AxiosAnalisisFinancieroRepository()
const currentYear = new Date().getFullYear()
const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const zeroMonth = (mes: number): AnalisisFinancieroMes => ({ mes, nombreMes: monthNames[mes - 1], prestamos: 0, pagos: 0, diferencia: 0, ganancia: 0 })
const compactMoney = (value: number) => { const absolute = Math.abs(value); if (absolute >= 1_000_000) return `₡${(value / 1_000_000).toLocaleString('es-CR', { maximumFractionDigits: 1 })} M`; if (absolute >= 1_000) return `₡${(value / 1_000).toLocaleString('es-CR', { maximumFractionDigits: 0 })} mil`; return `₡${value.toLocaleString('es-CR', { maximumFractionDigits: 0 })}` }
const signedMoney = (value: number) => value > 0 ? `+${formatCRC(value)}` : formatCRC(value)
const errorMessage = (cause: unknown) => cause instanceof Error && cause.message ? cause.message : 'No se pudo cargar el análisis financiero.'

export function AnalisisFinancieroPage() {
  const [mode, setMode] = useState<'monthly' | 'annual'>('monthly')
  const [year, setYear] = useState(String(currentYear))
  const [from, setFrom] = useState(String(currentYear - 1))
  const [to, setTo] = useState(String(currentYear))
  const [appliedFrom, setAppliedFrom] = useState(String(currentYear - 1))
  const [appliedTo, setAppliedTo] = useState(String(currentYear))
  const [monthly, setMonthly] = useState<ResumenMensualAnalisisFinanciero | null>(null)
  const [annual, setAnnual] = useState<ComparativoAnualAnalisisFinanciero | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const requestId = useRef(0)
  const draftRangeError = mode === 'annual' && (!/^\d{4}$/.test(from) || !/^\d{4}$/.test(to) || Number(from) > Number(to)) ? 'El año Desde debe ser menor o igual que el año Hasta.' : ''
  const rangeError = mode === 'annual' && (!/^\d{4}$/.test(appliedFrom) || !/^\d{4}$/.test(appliedTo) || Number(appliedFrom) > Number(appliedTo)) ? 'El año Desde debe ser menor o igual que el año Hasta.' : ''

  useEffect(() => {
    const id = ++requestId.current
    if (rangeError) { setAnnual(null); setError(rangeError); setLoading(false); return }
    setLoading(true); setError('')
    const request = mode === 'monthly' ? obtenerResumenMensual(repository, Number(year)) : obtenerComparativoAnual(repository, Number(appliedFrom), Number(appliedTo))
    void request.then((value) => { if (id === requestId.current) { if (mode === 'monthly') setMonthly(value as ResumenMensualAnalisisFinanciero); else setAnnual(value as ComparativoAnualAnalisisFinanciero) } }).catch((cause: unknown) => { if (id === requestId.current) { setMonthly(null); setAnnual(null); setError(errorMessage(cause)) } }).finally(() => { if (id === requestId.current) setLoading(false) })
  }, [mode, year, appliedFrom, appliedTo, rangeError, retryCount])

  const retry = () => setRetryCount((value) => value + 1)
  const months = useMemo(() => Array.from({ length: 12 }, (_, index) => monthly?.meses.find((row) => row.mes === index + 1) ?? zeroMonth(index + 1)), [monthly])
  const annualRows = annual?.anios ?? []

  return <main className="analisis-financiero-page">
    <div className="page-heading"><div><p className="eyebrow">FINANZAS / REPORTES</p><h1><BarChart3 size={25} aria-hidden="true" /> ANÁLISIS FINANCIERO</h1><p className="muted">Lectura agregada de préstamos, pagos, diferencia y ganancia informada por el backend.</p></div></div>
    <div className="panel analisis-financiero-toolbar">
      <div className="analisis-financiero-tabs" role="tablist" aria-label="Vista del análisis financiero"><button type="button" role="tab" aria-selected={mode === 'monthly'} className={mode === 'monthly' ? 'active' : ''} onClick={() => setMode('monthly')}>Resumen mensual</button><button type="button" role="tab" aria-selected={mode === 'annual'} className={mode === 'annual' ? 'active' : ''} onClick={() => setMode('annual')}>Comparar años</button></div>
      {mode === 'monthly' ? <label><CalendarDays size={16} aria-hidden="true" /> Año<select aria-label="Año del resumen mensual" value={year} onChange={(event) => setYear(event.target.value)}>{[currentYear - 4, currentYear - 3, currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((value) => <option key={value}>{value}</option>)}</select></label> : <div className="analisis-financiero-actions"><div className="analisis-financiero-range"><label>Desde <input aria-label="Año inicial" type="number" min="2000" max="2100" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>Hasta <input aria-label="Año final" type="number" min="2000" max="2100" value={to} onChange={(event) => setTo(event.target.value)} /></label></div><button type="button" className="primary-button" onClick={() => { setAppliedFrom(from); setAppliedTo(to); setRetryCount((value) => value + 1) }} disabled={!/^\d{4}$/.test(from) || !/^\d{4}$/.test(to) || Number(from) > Number(to) || loading}>Comparar</button></div>}
    </div>
    {draftRangeError && <p className="form-error" role="alert">{draftRangeError}</p>}
    {loading && <div className="panel state-box analisis-financiero-loading" role="status" aria-live="polite"><RefreshCw size={16} aria-hidden="true" /> Cargando análisis financiero...</div>}
    {!loading && error && <div className="panel state-box analisis-financiero-error" role="alert"><span>{error}</span><button type="button" className="secondary-button" onClick={retry}><RefreshCw size={15} aria-hidden="true" /> Reintentar</button></div>}
    {!loading && !error && mode === 'monthly' && monthly && <MonthlyView report={monthly} rows={months} />}
    {!loading && !error && mode === 'annual' && annual && <AnnualView rows={annualRows} />}
  </main>
}

function MonthlyView({ report, rows }: { report: ResumenMensualAnalisisFinanciero; rows: AnalisisFinancieroMes[] }) {
  const total = report.totales
  const noInformation = rows.every((row) => row.prestamos === 0 && row.pagos === 0 && row.ganancia === 0)
  return <><section className="analisis-financiero-metrics" aria-label="Totales del resumen mensual"><Metric label="PRÉSTAMOS" value={formatCRC(total.prestamos)} /><Metric label="PAGOS" value={formatCRC(total.pagos)} /><Metric label="DIFERENCIA" value={signedMoney(total.diferencia)} tone={tone(total.diferencia)} /><Metric label="GANANCIA" value={formatCRC(total.ganancia)} /></section><p className="analisis-financiero-help">PRÉSTAMOS: Dinero efectivamente desembolsado durante el período. PAGOS: Dinero recibido mediante pagos registrados. DIFERENCIA: Pagos recibidos menos préstamos desembolsados. GANANCIA: Intereses efectivamente cobrados mediante pagos registrados.</p>{noInformation && <p className="panel state-box analisis-financiero-empty" role="status">No hay información financiera para el año seleccionado.</p>}<section className="analisis-financiero-charts"><Chart title="Evolución mensual" data={rows.map((row) => ({ ...row, etiqueta: monthNames[row.mes - 1] }))} description="Préstamos, pagos y ganancia por mes." /><Chart title="Ganancia mensual" data={rows.map((row) => ({ ...row, etiqueta: monthNames[row.mes - 1] }))} lines={['ganancia']} description="Ganancia informada por el backend para cada mes." /></section><section className="panel analisis-financiero-table-panel"><h2>Detalle mensual {report.anio}</h2><FinancialTable rows={rows} total={total} monthly /></section></>
}

function AnnualView({ rows }: { rows: AnalisisFinancieroAnio[] }) {
  const noInformation = rows.length === 0 || rows.every((row) => row.prestamos === 0 && row.pagos === 0 && row.ganancia === 0)
  return <>{noInformation && <p className="panel state-box analisis-financiero-empty" role="status">No hay información financiera para el rango seleccionado.</p>}<section className="analisis-financiero-charts"><Chart title="Comparativo anual" data={rows.map((row) => ({ ...row, etiqueta: String(row.anio) }))} description="Préstamos, pagos y ganancia por año." /><Chart title="Ganancia anual" data={rows.map((row) => ({ ...row, etiqueta: String(row.anio) }))} lines={['ganancia']} description="Ganancia informada por el backend para cada año." /></section><section className="panel analisis-financiero-table-panel"><h2>Comparativo por año</h2><FinancialTable rows={rows} /></section></>
}

function Metric({ label, value, tone: metricTone = 'default' }: { label: string; value: string; tone?: 'positive' | 'negative' | 'neutral' | 'default' }) { return <div className={`panel analisis-financiero-metric ${metricTone}`}><span>{label}</span><strong>{value}</strong></div> }
function tone(value: number): 'positive' | 'negative' | 'neutral' { return value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral' }
type FinancialRow = AnalisisFinancieroMes | AnalisisFinancieroAnio
function FinancialTable({ rows, total, monthly = false }: { rows: FinancialRow[]; total?: { prestamos: number; pagos: number; diferencia: number; ganancia: number }; monthly?: boolean }) { return <div className="table-wrap"><table><caption>{monthly ? 'Detalle mensual del análisis financiero' : 'Comparativo anual del análisis financiero'}</caption><thead><tr><th scope="col">{monthly ? 'Mes' : 'Año'}</th><th scope="col">Préstamos</th><th scope="col">Pagos</th><th scope="col">Diferencia</th><th scope="col">Ganancia</th></tr></thead><tbody>{rows.map((row) => <tr key={monthly ? (row as AnalisisFinancieroMes).mes : (row as AnalisisFinancieroAnio).anio}><th scope="row">{monthly ? (row as AnalisisFinancieroMes).nombreMes : (row as AnalisisFinancieroAnio).anio}</th><td>{formatCRC(row.prestamos)}</td><td>{formatCRC(row.pagos)}</td><td>{signedMoney(row.diferencia)}</td><td>{formatCRC(row.ganancia)}</td></tr>)}{total && <tr className="analisis-financiero-total-row"><th scope="row">TOTAL</th><th scope="col">{formatCRC(total.prestamos)}</th><th scope="col">{formatCRC(total.pagos)}</th><th scope="col">{signedMoney(total.diferencia)}</th><th scope="col">{formatCRC(total.ganancia)}</th></tr>}</tbody></table></div> }
type ChartRow = { etiqueta: string; prestamos: number; pagos: number; ganancia: number }
function Chart({ title, data, description, lines = ['prestamos', 'pagos', 'ganancia'] }: { title: string; data: ChartRow[]; description: string; lines?: string[] }) { const descriptionId = useId(); const labels: Record<string, string> = { prestamos: 'Préstamos', pagos: 'Pagos', ganancia: 'Ganancia' }; const colors: Record<string, string> = { prestamos: '#276678', pagos: '#2a9d8f', ganancia: '#e9a227' }; return <section className="panel analisis-financiero-chart" aria-labelledby={`${descriptionId}-title`}><h2 id={`${descriptionId}-title`}>{title}</h2><p id={descriptionId} className="visually-hidden">{description} {data.map((row) => `${row.etiqueta}: ${lines.map((line) => `${labels[line]} ${formatCRC(row[line as keyof ChartRow] as number)}`).join(', ')}`).join('; ')}</p><div className="analisis-financiero-chart-canvas" role="img" aria-describedby={descriptionId}><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="etiqueta" /><YAxis tickFormatter={(value) => compactMoney(Number(value))} /><Tooltip formatter={(value) => formatCRC(Number(value ?? 0))} /><Legend />{lines.map((line) => <Line key={line} type="monotone" dataKey={line} name={labels[line]} stroke={colors[line]} strokeWidth={2} dot={false} />)}</LineChart></ResponsiveContainer></div></section> }
