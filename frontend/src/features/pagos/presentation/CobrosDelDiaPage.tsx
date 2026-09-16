import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Eye, RefreshCw, WalletCards } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatCRC } from '@/shared/utils/currency'
import { addDaysDateOnly, formatDateOnly, isValidDateOnly, todayInCostaRica } from '@/shared/utils/date'
import { prestamoErrorMessage } from '@/features/prestamos/domain/prestamo.error'
import { consultarCobrosDelDia } from '../application/cobros-del-dia.use-cases'
import { AxiosCobrosDelDiaRepository } from '../infrastructure/axios-cobros-del-dia.repository'
import type { CobroDelDia, CobrosDelDiaResponse } from '../domain/cobros-del-dia.types'
import './cobros-del-dia.css'

const repository = new AxiosCobrosDelDiaRepository()

function Metric({ label, value, money = false }: { label: string; value: number; money?: boolean }) {
  return <div className="cobros-metric"><span>{label}</span><strong>{money ? formatCRC(value) : value}</strong></div>
}

export function CobrosDelDiaPage() {
  const navigate = useNavigate()
  const [fecha, setFecha] = useState(todayInCostaRica)
  const [data, setData] = useState<CobrosDelDiaResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)
    setError('')
    setData(null)
    if (!isValidDateOnly(fecha)) {
      setLoading(false)
      return
    }
    try {
      const response = await consultarCobrosDelDia(repository, fecha)
      if (current === requestId.current) setData(response)
    } catch (cause) {
      if (current === requestId.current) setError(prestamoErrorMessage(cause))
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [fecha])

  useEffect(() => { void load(); return () => { requestId.current += 1 } }, [load])

  const moveDate = (days: number) => setFecha(current => isValidDateOnly(current) ? addDaysDateOnly(current, days) : current)
  const openLoan = (row: CobroDelDia) => navigate('/prestamos', { state: { prestamoId: row.prestamoId } })

  return <section className="cobros-page">
    <div className="page-heading"><div><p className="eyebrow">PAGOS</p><h1>Cobros del día</h1><p className="muted">Consulta operativa de cuotas programadas y pagos recibidos.</p></div><button className="secondary-button" type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15} /> Actualizar</button></div>
    <div className="cobros-toolbar" aria-label="Selector de fecha de cobro"><button className="secondary-button" type="button" onClick={() => moveDate(-1)} disabled={loading || !isValidDateOnly(fecha)} aria-label="Día anterior"><ChevronLeft size={16} /> Día anterior</button><label>Fecha de cobro<input type="date" value={fecha} onChange={event => setFecha(event.target.value)} disabled={loading} /></label><button className="secondary-button" type="button" onClick={() => setFecha(todayInCostaRica())} disabled={loading || fecha === todayInCostaRica()}>Hoy</button><button className="secondary-button" type="button" onClick={() => moveDate(1)} disabled={loading || !isValidDateOnly(fecha)} aria-label="Día siguiente">Día siguiente <ChevronRight size={16} /></button></div>
    {loading && <p className="cobros-state" role="status">Cargando cobros...</p>}
    {!loading && error && <div className="cobros-error" role="alert"><span>No se pudieron cargar los cobros.</span><button className="secondary-button" type="button" onClick={() => void load()}><RefreshCw size={14} /> Reintentar</button></div>}
    {!loading && !error && data && <>
      <div className="cobros-metrics"><Metric label="Programados" value={data.totales.cantidadProgramados} /><Metric label="Pagados" value={data.totales.cantidadPagados} /><Metric label="Pendientes" value={data.totales.cantidadPendientes} /><Metric label="Monto programado" value={data.totales.montoProgramado} money /><Metric label="Monto recibido" value={data.totales.montoRecibido} money /></div>
      {data.filas.length === 0 ? <p className="cobros-empty" role="status">No hay cobros programados para {formatDateOnly(fecha)}.</p> : <div className="panel cobros-table-panel"><div className="table-wrap"><table className="cobros-table"><caption>Cobros del {formatDateOnly(fecha)}</caption><thead><tr><th>Cliente / contacto</th><th>Préstamo</th><th>Cuota</th><th>Fecha de vencimiento</th><th>Monto programado</th><th>Monto recibido</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{data.filas.map(row => <tr key={row.planPagoId}><td><strong>{row.nombreCompleto}</strong><small>{row.identificacion} · {row.telefonoPrincipal}</small></td><td>#{row.prestamoId}</td><td>{row.numeroPago}</td><td>{formatDateOnly(row.fecha)}</td><td>{formatCRC(row.montoProgramado)}</td><td>{formatCRC(row.montoPagado)}</td><td><span className={`cobros-status cobros-status-${row.estado.toLowerCase()}`}>{row.estado}</span></td><td className="cobros-actions"><button className="table-action" type="button" onClick={() => openLoan(row)} title="Ver préstamo" aria-label={`Ver préstamo ${row.prestamoId}`}><Eye size={16} /></button>{row.estado === 'PENDIENTE' && <button className="table-action" type="button" onClick={() => navigate('/pagos/registrar', { state: { prestamoId: row.prestamoId } })} title="Registrar pago" aria-label={`Registrar pago del préstamo ${row.prestamoId}`}><WalletCards size={16} /></button>}</td></tr>)}</tbody></table></div></div>}
    </>}
  </section>
}
