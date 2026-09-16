import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarDays, CircleDollarSign, RefreshCw, TrendingUp } from 'lucide-react'
import { formatCRC } from '@/shared/utils/currency'
import { obtenerRentabilidadCancelados } from '../application/rentabilidad-cancelados.use-cases'
import type { RentabilidadCanceladosReport } from '../domain/rentabilidad-cancelados.types'
import { AxiosRentabilidadCanceladosRepository } from '../infrastructure/axios-rentabilidad-cancelados.repository'
import './rentabilidad-cancelados.css'

const repository = new AxiosRentabilidadCanceladosRepository()
const now = new Date()
const initialMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
const colors = ['#1f6f8b', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51']
const safeNumber = (value: number | undefined) => Number.isFinite(value) ? value ?? 0 : 0

export function RentabilidadCanceladosPage() {
  const [month, setMonth] = useState(initialMonth)
  const [report, setReport] = useState<RentabilidadCanceladosReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const requestId = useRef(0)

  useEffect(() => {
    const [year, selectedMonth] = month.split('-').map(Number)
    const id = ++requestId.current
    setLoading(true); setError('')
    void obtenerRentabilidadCancelados(repository, year, selectedMonth).then((value) => {
      if (id === requestId.current) setReport(value)
    }).catch((cause: unknown) => {
      if (id === requestId.current) { setReport(null); setError(cause instanceof Error ? cause.message : 'No se pudo cargar el reporte de rentabilidad.') }
    }).finally(() => { if (id === requestId.current) setLoading(false) })
  }, [month, retryCount])

  const summary = report?.resumen
  const rows = report?.porPlazo ?? []
  const hasData = Boolean(summary?.prestamosCancelados)
  const retry = () => setRetryCount((value) => value + 1)

  return <main className="rentabilidad-report-page">
      <div className="page-heading">
       <div><p className="eyebrow">CIERRE MENSUAL</p><h1><TrendingUp size={25} aria-hidden="true" /> Reporte de préstamos cancelados</h1><p className="muted">Rentabilidad real agregada por eventos históricos CANCELADO ocurridos en el período; no depende del estado actual.</p></div>
      <label className="rentabilidad-month-picker"><CalendarDays size={16} aria-hidden="true" /><span>Mes</span><input type="month" value={month} max={initialMonth} onChange={(event) => setMonth(event.target.value)} /></label>
    </div>
    {loading && <div className="panel state-box" role="status">Cargando reporte...</div>}
    {!loading && error && <div className="panel state-box" role="alert"><span>{error}</span><button type="button" className="secondary-button" onClick={retry}><RefreshCw size={15} /> Reintentar</button></div>}
    {!loading && !error && report && <>
      <section className="rentabilidad-metrics" aria-label="Resumen de rentabilidad">
        <Metric label="Préstamos cancelados" value={String(summary?.prestamosCancelados ?? 0)} icon={<TrendingUp />} />
        <Metric label="Capital" value={formatCRC(safeNumber(summary?.capitalTotal))} icon={<CircleDollarSign />} />
        <Metric label="Ganancia (intereses)" value={formatCRC(safeNumber(summary?.gananciaTotal))} icon={<TrendingUp />} />
        <Metric label="Rentabilidad total" value={`${safeNumber(summary?.rentabilidadTotal).toFixed(2)}%`} icon={<TrendingUp />} />
        <Metric label="Tasa equivalente a 30 días" value={`${safeNumber(summary?.tasa30Dias).toFixed(2)}%`} icon={<CalendarDays />} />
      </section>
       {!hasData && <div className="panel state-box rentabilidad-empty">No hay eventos históricos CANCELADO dentro del mes seleccionado.</div>}
      {hasData && <>
        <section className="rentabilidad-charts">
          <div className="panel rentabilidad-chart-panel"><h2>Tasa por plazo</h2><div className="rentabilidad-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows}><XAxis dataKey="plazo" tick={{ fontSize: 11 }} /><YAxis unit="%" /><Tooltip formatter={(value) => [`${safeNumber(Number(value)).toFixed(2)}%`, 'Tasa 30 días']} /><Bar dataKey="tasa30Dias" fill="var(--color-primary)" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
           <div className="panel rentabilidad-chart-panel"><h2>Distribución del capital</h2><div className="rentabilidad-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={rows.filter((row) => row.capital > 0)} dataKey="capital" nameKey="plazo" innerRadius={58} outerRadius={92} paddingAngle={2}>{rows.filter((row) => row.capital > 0).map((row, index) => <Cell key={`${row.plazo}-${index}`} fill={colors[index % colors.length]} />)}</Pie><Tooltip formatter={(value) => [formatCRC(safeNumber(Number(value))), 'Capital']} /></PieChart></ResponsiveContainer></div></div>
        </section>
         <section className="panel rentabilidad-table-panel"><h2>Rentabilidad agregada por plazo</h2><div className="table-wrap"><table><thead><tr><th>Plazo real</th><th>Eventos CANCELADO</th><th>Capital</th><th>Ganancia</th><th>Rentabilidad</th><th>Tasa 30 días</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.plazo}-${index}`}><td>{row.plazo}</td><td>{row.cantidad}</td><td>{formatCRC(row.capital)}</td><td>{formatCRC(row.ganancia)}</td><td>{safeNumber(row.rentabilidadTotal).toFixed(2)}%</td><td>{safeNumber(row.tasa30Dias).toFixed(2)}%</td></tr>)}<tr className="rentabilidad-total-row"><th>TOTAL</th><th>{summary?.prestamosCancelados ?? 0}</th><th>{formatCRC(safeNumber(summary?.capitalTotal))}</th><th>{formatCRC(safeNumber(summary?.gananciaTotal))}</th><th>{safeNumber(summary?.rentabilidadTotal).toFixed(2)}%</th><th>{safeNumber(summary?.tasa30Dias).toFixed(2)}%</th></tr></tbody></table></div></section>
        {report.metadata.registrosSinDuracionValida > 0 && <p className="rentabilidad-metadata">{report.metadata.registrosSinDuracionValida} registro(s) se incluyeron en capital y ganancia, pero no en métricas temporales por duración real no válida.</p>}
      </>}
    </>}
  </main>
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) { return <div className="panel rentabilidad-metric"><span className="rentabilidad-metric-icon">{icon}</span><span>{label}</span><strong>{value}</strong></div> }
