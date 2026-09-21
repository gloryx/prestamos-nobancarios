import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, BarChart3, CircleDollarSign, Coins, HandCoins, RefreshCw, TrendingUp, Wallet } from 'lucide-react'
import { useAuth } from '@/app/providers/auth-context'
import { formatCRC } from '@/shared/utils/currency'
import { todayInCostaRica } from '@/shared/utils/date'
import { AxiosDashboardRepository } from './infrastructure/axios-dashboard.repository'
import type { DashboardData } from './domain/dashboard.types'

const repository = new AxiosDashboardRepository()
const money = (value: number) => formatCRC(value)
const signedMoney = (value: number) => value > 0 ? `+${money(value)}` : money(value)
const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function DashboardPage() {
  const { user } = useAuth()
  const periodo = todayInCostaRica().slice(0, 7)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const load = useCallback(() => {
    const currentRequest = ++requestId.current
    setLoading(true)
    setError(null)
    void repository.get(periodo).then((result) => {
      if (currentRequest === requestId.current) setData(result)
    }).catch(() => {
      if (currentRequest === requestId.current) setError('No se pudo cargar el resumen del dashboard.')
    }).finally(() => {
      if (currentRequest === requestId.current) setLoading(false)
    })
  }, [periodo])

  useEffect(() => {
    load()
    return () => { requestId.current += 1 }
  }, [load])

  const [year, month] = periodo.split('-')
  const monthLabel = `${monthNames[Number(month) - 1]} ${year}`

  return <main className="dashboard" aria-labelledby="dashboard-title">
    <div className="page-heading">
      <div><p className="eyebrow">{monthLabel.toUpperCase()}</p><h1 id="dashboard-title">Buenos días, {user?.nombreCompleto ?? 'usuario'}</h1><p className="muted">Resumen de la operación financiera con datos reales.</p></div>
    </div>
    {loading && <div className="panel dashboard-state" role="status" aria-live="polite"><RefreshCw size={16} aria-hidden="true" /> Cargando resumen...</div>}
    {!loading && error && <div className="panel dashboard-state dashboard-error" role="alert"><AlertCircle size={16} aria-hidden="true" /> <span>{error}</span><button className="secondary-button" type="button" onClick={load}><RefreshCw size={15} aria-hidden="true" /> Reintentar</button></div>}
    {!loading && !error && data && <DashboardContent data={data} onRetry={load} />}
  </main>
}

function DashboardContent({ data, onRetry }: { data: DashboardData; onRetry: () => void }) {
  const { flujo, cartera } = data
  const metrics = [
     cartera && ['Cartera actual', money(cartera.capitalPendiente), 'Préstamos ACTIVO · capital pendiente', Wallet],
    flujo && ['Capital nuevo colocado', money(flujo.capitalColocado), 'Mes económico actual', Coins],
    flujo && ['Pagos recibidos', money(flujo.pagosRecibidos), 'Pagos REGISTRADOS', HandCoins],
    flujo && ['Capital recuperado', money(flujo.capitalRecuperado), 'Aplicado a capital', CircleDollarSign],
    flujo && ['Ganancia realizada', money(flujo.gananciaRealizada), 'Interés aplicado en pagos', TrendingUp],
    flujo && ['Flujo neto', signedMoney(flujo.flujoNeto), 'No representa utilidad', BarChart3],
  ].filter(Boolean) as Array<[string, string, string, typeof Wallet]>
  const hasMovement = flujo && (flujo.capitalColocado !== 0 || flujo.pagosRecibidos !== 0)

  return <>
    {data.errors.length > 0 && <div className="panel dashboard-state dashboard-partial" role="status"><AlertCircle size={16} aria-hidden="true" /><span>Datos parciales: {data.errors.join(' ')}</span><button className="secondary-button" type="button" onClick={onRetry}>Reintentar</button></div>}
    {metrics.length > 0 && <section className="dashboard-metrics" aria-label="Indicadores del mes económico actual">
      {metrics.map(([label, value, detail, Icon]) => <div className="indicator-card" key={label}><div className="indicator-top"><span>{label}</span><Icon size={19} aria-hidden="true" /></div><strong>{value}</strong><small>{detail}</small></div>)}
    </section>}
    {flujo && <section className="panel dashboard-financial" aria-labelledby="dashboard-financial-title"><div className="panel-title"><h2 id="dashboard-financial-title">Resumen financiero · {data.periodo}</h2></div><div className="dashboard-financial-grid"><Summary label="Capital nuevo colocado" value={money(flujo.capitalColocado)} /><Summary label="Pagos recibidos" value={money(flujo.pagosRecibidos)} /><Summary label="Capital recuperado" value={money(flujo.capitalRecuperado)} /><Summary label="Ganancia realizada" value={money(flujo.gananciaRealizada)} /><Summary label="Flujo neto" value={signedMoney(flujo.flujoNeto)} /></div><p className="dashboard-note">Flujo neto = pagos recibidos − capital nuevo colocado. No representa utilidad.</p>{!hasMovement && <p className="dashboard-empty" role="status">No hay movimientos financieros en el mes económico actual.</p>}</section>}
  </>
}

function Summary({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div> }
