import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { Search, WalletCards } from 'lucide-react'
import { formatCRC } from '@/shared/utils/currency'
import { formatDateOnly, isValidDateOnly, todayInCostaRica } from '@/shared/utils/date'
import { obtenerEstadoCaja } from '../application/movimientos-caja.use-cases'
import type { EstadoCaja, EstadoCajaDesglose } from '../domain/movimiento-caja.types'
import { AxiosMovimientoCajaRepository } from '../infrastructure/axios-movimiento-caja.repository'
import './estado-caja.css'

const repository = new AxiosMovimientoCajaRepository()
const today = todayInCostaRica()

const categories: Array<[keyof EstadoCajaDesglose, string]> = [
  ['pagosClientes', 'Pagos de clientes'],
  ['aportesCapital', 'Aportes de capital'],
  ['ajustes', 'Ajustes de entrada/salida'],
  ['desembolsosPrestamos', 'Desembolsos de préstamos'],
  ['desembolsosRefinanciamientos', 'Desembolsos de refinanciamientos'],
  ['retiros', 'Retiros'],
  ['gastos', 'Gastos'],
  ['reversos', 'Reversos'],
  ['otros', 'Otros'],
]

export function EstadoCajaPage() {
  const [draftDate, setDraftDate] = useState(today)
  const [appliedDate, setAppliedDate] = useState(today)
  const [state, setState] = useState<EstadoCaja | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestVersion, setRequestVersion] = useState(0)
  const requestSequence = useRef(0)

  useEffect(() => {
    const request = ++requestSequence.current
    void obtenerEstadoCaja(repository, appliedDate)
      .then(result => { if (request === requestSequence.current) setState(result) })
      .catch(reason => { if (request === requestSequence.current) setError(readError(reason)) })
      .finally(() => { if (request === requestSequence.current) setLoading(false) })
  }, [appliedDate, requestVersion])

  const consult = () => {
    if (!isValidDateOnly(draftDate)) { setError('Ingresa una fecha válida.'); return }
    if (draftDate > today) { setError('La fecha de consulta no puede ser posterior a hoy.'); return }
    setState(null)
    setLoading(true)
    setError('')
    setAppliedDate(draftDate)
    setRequestVersion(version => version + 1)
  }

  return <section className="estado-caja-page">
    <div className="page-heading"><div><p className="eyebrow">FINANZAS / CAJA</p><h1><WalletCards size={25} aria-hidden="true" /> Estado de Caja</h1><p className="muted">Consulta el efectivo disponible y su composición para una fecha económica.</p></div></div>
    <div className="panel estado-caja-toolbar">
      <label htmlFor="estado-caja-fecha">Fecha de consulta<input id="estado-caja-fecha" type="date" value={draftDate} max={today} onChange={event => setDraftDate(event.target.value)} /></label>
      <button className="primary-button" type="button" onClick={consult} disabled={loading}><Search size={16} aria-hidden="true" /> Consultar</button>
    </div>
    {error && <div className="panel estado-caja-error" role="alert"><strong>No se pudo consultar el estado de Caja</strong><span>{error}</span><button className="secondary-button" type="button" onClick={consult}>Reintentar</button></div>}
    {loading && <div className="panel estado-caja-state" role="status">Cargando estado de Caja…</div>}
    {!loading && !error && state && <EstadoCajaContent state={state} />}
  </section>
}

function EstadoCajaContent({ state }: { state: EstadoCaja }) {
  const originLabel = state.origenSaldo === 'APERTURA' ? 'Apertura financiera' : 'Último cierre mensual'
  return <div className="estado-caja-content">
    <div className="estado-caja-grid">
      <div className="panel estado-caja-available"><span>Disponible</span><strong>{formatCRC(state.disponible)}</strong><small>Al {formatDateOnly(state.fechaConsulta)}</small></div>
      <div className="panel estado-caja-source"><div className="panel-title"><div><h2>Origen del disponible</h2><p className="muted">Base utilizada para el período consultado</p></div></div><strong>{originLabel}</strong><span>{formatDateOnly(state.fechaOrigen)} · {formatCRC(state.disponibleOrigen)}</span></div>
    </div>
    <div className="panel estado-caja-equation" aria-label="Origen más entradas menos salidas igual a disponible"><div><span>Origen</span><strong>{formatCRC(state.disponibleOrigen)}</strong></div><b aria-hidden="true">+</b><div><span>Entradas</span><strong className="estado-caja-entry-amount">{formatCRC(state.entradas.total)}</strong></div><b aria-hidden="true">−</b><div><span>Salidas</span><strong className="estado-caja-exit-amount">{formatCRC(state.salidas.total)}</strong></div><b aria-hidden="true">=</b><div className="equation-result"><span>Disponible</span><strong>{formatCRC(state.disponible)}</strong></div></div>
    <div className="estado-caja-metrics"><Metric label="Entrada total" value={signed(state.entradas.total)} tone="entry" /><Metric label="Salida total" value={`−${formatCRC(state.salidas.total)}`} tone="exit" /><Metric label="Flujo neto" value={signed(state.flujoNeto)} tone={state.flujoNeto > 0 ? 'positive' : state.flujoNeto < 0 ? 'negative' : 'neutral'} note="El flujo neto no representa utilidad." /></div>
    <div className="estado-caja-breakdowns"><Breakdown title="Entradas" data={state.entradas} /><Breakdown title="Salidas" data={state.salidas} /></div>
    <div className="panel estado-caja-notes"><strong>{state.cantidadMovimientos.toLocaleString('es-CR')} movimientos considerados</strong><p>El efectivo disponible no es utilidad ni representa la cartera de préstamos.</p><p>Los desembolsos de refinanciamientos corresponden a dinero nuevo; el capital trasladado no es una nueva salida.</p></div>
  </div>
}

function Breakdown({ title, data }: { title: string; data: EstadoCajaDesglose }) {
  const tone = title === 'Entradas' ? 'entry' : 'exit'
  return <div className={`panel estado-caja-breakdown estado-caja-breakdown-${tone}`}><div className="panel-title"><h2>{title}</h2><strong>{formatCRC(data.total)}</strong></div>{categories.filter(([key]) => data[key] !== 0).map(([key, label]) => <div className="estado-caja-breakdown-row" key={key}><span>{label}</span><strong>{formatCRC(data[key])}</strong></div>)}</div>
}

function Metric({ label, value, tone, note }: { label: string; value: string; tone?: 'entry' | 'exit' | 'positive' | 'negative' | 'neutral'; note?: string }) { return <div className="panel estado-caja-metric"><span>{label}</span><strong className={tone ? `estado-caja-${tone}-amount` : undefined}>{value}</strong>{note && <small>{note}</small>}</div> }
function signed(value: number) { return `${value >= 0 ? '+' : ''}${formatCRC(value)}` }

function readError(reason: unknown): string {
  if (axios.isAxiosError(reason)) {
    const message = reason.response?.data && typeof reason.response.data === 'object' && 'message' in reason.response.data ? reason.response.data.message : undefined
    if (typeof message === 'string') return message
    if (Array.isArray(message)) return message.join(' ')
  }
  return 'No fue posible obtener el estado de Caja. Intentá nuevamente.'
}
