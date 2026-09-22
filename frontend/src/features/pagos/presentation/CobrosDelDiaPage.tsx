import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Eye, HandCoins, Printer, RefreshCw, Settings2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/providers/auth-context'
import { formatCRC } from '@/shared/utils/currency'
import { addDaysDateOnly, formatDateOnly, isValidDateOnly, todayInCostaRica } from '@/shared/utils/date'
import { abrirPlanPagoPdf } from '@/features/prestamos/application/prestamos.use-cases'
import { AxiosPrestamoRepository } from '@/features/prestamos/infrastructure/axios-prestamo.repository'
import { prestamoErrorMessage } from '@/features/prestamos/domain/prestamo.error'
import { listUsuariosSelector } from '@/features/usuarios/application/usuarios.use-cases'
import { AxiosUsuarioRepository } from '@/features/usuarios/infrastructure/axios-usuario.repository'
import type { UsuarioSelector } from '@/features/usuarios/domain/usuario.types'
import { consultarCobrosDelDia } from '../application/cobros-del-dia.use-cases'
import { AxiosCobrosDelDiaRepository } from '../infrastructure/axios-cobros-del-dia.repository'
import type { CobroDelDia, CobrosDelDiaResponse } from '../domain/cobros-del-dia.types'
import './cobros-del-dia.css'

const repository = new AxiosCobrosDelDiaRepository()
const usuarioRepository = new AxiosUsuarioRepository()
const prestamoRepository = new AxiosPrestamoRepository()

function Metric({ label, value, money = false }: { label: string; value: number; money?: boolean }) {
  return <div className="cobros-metric"><span>{label}</span><strong>{money ? formatCRC(value) : value}</strong></div>
}

type RouteStatus = 'COBRADO' | 'NO_COBRADO'
type RouteNote = { status: RouteStatus | null; observation: string }

function RouteView({ fecha, rows, collector, onBack }: { fecha: string; rows: CobroDelDia[]; collector: UsuarioSelector; onBack: () => void }) {
  const [notes, setNotes] = useState<Record<number, RouteNote>>(() => Object.fromEntries(rows.map(row => [row.planPagoId, { status: null, observation: '' }])))
  const paidRows = rows.filter(row => notes[row.planPagoId]?.status === 'COBRADO')
  const setStatus = (id: number, status: RouteStatus) => setNotes(current => ({ ...current, [id]: { ...current[id], status } }))
  const setObservation = (id: number, observation: string) => setNotes(current => ({ ...current, [id]: { ...current[id], observation } }))
  return <section className="cobros-route-view" aria-labelledby="cobros-route-title">
    <div className="page-heading cobros-route-heading"><div><p className="eyebrow">LISTA PARA COBRADOR</p><h1 id="cobros-route-title">Ruta de cobro</h1></div><div className="cobros-route-actions"><button className="secondary-button" type="button" onClick={onBack}>Volver</button><button className="primary-button" type="button" onClick={() => window.print()}><Printer size={15} /> Imprimir</button></div></div>
    <div className="panel cobros-route-header"><div><span>Fecha</span><strong>{formatDateOnly(fecha)}</strong></div><div><span>Cobrador</span><strong>{collector.nombreCompleto}</strong></div><div><span>Cantidad</span><strong>{rows.length}</strong></div><div><span>Saldo por cobrar</span><strong>{formatCRC(rows.reduce((total, row) => total + row.saldoPendiente, 0))}</strong></div></div>
    <div className="panel table-wrap"><table className="cobros-route-table"><thead><tr><th>Cliente</th><th>Préstamo</th><th>Cuota</th><th>Saldo operativo</th><th>Cobrado</th><th>No cobrado</th><th>Observaciones</th></tr></thead><tbody>{rows.map(row => { const note = notes[row.planPagoId]; return <tr key={row.planPagoId}><td>{row.nombreCompleto}</td><td>#{row.prestamoId}</td><td>{row.numeroPago}</td><td>{formatCRC(row.saldoPendiente)}</td><td><input type="checkbox" checked={note.status === 'COBRADO'} onChange={() => setStatus(row.planPagoId, 'COBRADO')} aria-label={`Cobrado: ${row.nombreCompleto}`} /></td><td><input type="checkbox" checked={note.status === 'NO_COBRADO'} onChange={() => setStatus(row.planPagoId, 'NO_COBRADO')} aria-label={`No cobrado: ${row.nombreCompleto}`} /></td><td><input type="text" value={note.observation} onChange={event => setObservation(row.planPagoId, event.target.value)} aria-label={`Observaciones: ${row.nombreCompleto}`} /></td></tr> })}</tbody></table></div>
    <section className="panel cobros-route-summary"><h2>RESUMEN DE RUTA</h2><div className="cobros-route-summary-grid"><div><span>Cantidad asignada</span><strong>{rows.length}</strong></div><div><span>Realizados</span><strong>{paidRows.length}</strong></div><div><span>No realizados</span><strong>{rows.filter(row => notes[row.planPagoId]?.status === 'NO_COBRADO').length}</strong></div><div><span>Total por cobrar</span><strong>{formatCRC(rows.reduce((total, row) => total + row.saldoPendiente, 0))}</strong></div></div><label>Observaciones generales<textarea rows={3} /></label></section>
  </section>
}

export function CobrosDelDiaPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canRegisterPayment = user?.rol === 'ADMINISTRADOR' || user?.rol === 'VENDEDOR' || user?.rol === 'COBRADOR'
  const canPersonalizePlan = user?.rol === 'ADMINISTRADOR' || user?.rol === 'VENDEDOR'
  const [fecha, setFecha] = useState(todayInCostaRica)
  const [data, setData] = useState<CobrosDelDiaResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestId = useRef(0)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [collectorModal, setCollectorModal] = useState(false)
  const [collectors, setCollectors] = useState<UsuarioSelector[]>([])
  const [collectorLoading, setCollectorLoading] = useState(false)
  const [collectorError, setCollectorError] = useState('')
  const [route, setRoute] = useState<{ rows: CobroDelDia[]; collector: UsuarioSelector } | null>(null)
  const [actionError, setActionError] = useState('')
  const headerCheckbox = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true); setError(''); setData(null)
    if (!isValidDateOnly(fecha)) { setLoading(false); return }
    try { const response = await consultarCobrosDelDia(repository, fecha); if (current === requestId.current) setData(response) }
    catch (cause) { if (current === requestId.current) setError(prestamoErrorMessage(cause)) }
    finally { if (current === requestId.current) setLoading(false) }
  }, [fecha])
  useEffect(() => { void load(); return () => { requestId.current += 1 } }, [load])

  const obligations = data?.porCobrar ?? []
  const selectedRows = obligations.filter(row => selectedIds.includes(row.planPagoId))
  const allSelected = obligations.length > 0 && obligations.every(row => selectedIds.includes(row.planPagoId))
  const moveDate = (days: number) => setFecha(current => isValidDateOnly(current) ? addDaysDateOnly(current, days) : current)
  const changeDate = (value: string) => { setSelectedIds([]); setRoute(null); setFecha(value) }
  const toggleAll = () => setSelectedIds(allSelected ? [] : obligations.map(row => row.planPagoId))
  const toggleRow = (id: number) => setSelectedIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])
  const openCollectorModal = async () => { setCollectorModal(true); setCollectorError(''); setCollectorLoading(true); try { setCollectors(await listUsuariosSelector(usuarioRepository)) } catch (cause) { setCollectorError(prestamoErrorMessage(cause)) } finally { setCollectorLoading(false) } }
  const printLoan = (prestamoId: number) => { void abrirPlanPagoPdf(prestamoRepository, prestamoId).catch(cause => setActionError(prestamoErrorMessage(cause))) }
  useEffect(() => { if (headerCheckbox.current) headerCheckbox.current.indeterminate = selectedRows.length > 0 && !allSelected }, [allSelected, selectedRows.length])
  if (route) return <RouteView fecha={fecha} rows={route.rows} collector={route.collector} onBack={() => setRoute(null)} />

  return <section className="cobros-page">
    <div className="page-heading"><div><p className="eyebrow">PAGOS</p><h1>Cobros del día</h1><p className="muted">Consulta separada de obligaciones por cobrar y pagos recibidos.</p></div><button className="secondary-button" type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15} /> Actualizar</button></div>
    <div className="cobros-toolbar" aria-label="Selector de fecha de cobro"><button className="secondary-button" type="button" onClick={() => moveDate(-1)} disabled={loading || !isValidDateOnly(fecha)} aria-label="Día anterior"><ChevronLeft size={16} /> Día anterior</button><label>Fecha de cobro<input type="date" value={fecha} onChange={event => changeDate(event.target.value)} disabled={loading} /></label><button className="secondary-button" type="button" onClick={() => changeDate(todayInCostaRica())} disabled={loading || fecha === todayInCostaRica()}>Hoy</button><button className="secondary-button" type="button" onClick={() => moveDate(1)} disabled={loading || !isValidDateOnly(fecha)} aria-label="Día siguiente">Día siguiente <ChevronRight size={16} /></button></div>
    {loading && <p className="cobros-state" role="status">Cargando cobros...</p>}
    {!loading && error && <div className="cobros-error" role="alert"><span>No se pudieron cargar los cobros.</span><button className="secondary-button" type="button" onClick={() => void load()}><RefreshCw size={14} /> Reintentar</button></div>}
    {!loading && !error && data && <><div className="cobros-metrics"><Metric label="Por cobrar" value={data.totales.porCobrar.cantidad} /><Metric label="Pagaron" value={data.totales.pagaron.cantidad} /><Metric label="Monto por cobrar" value={data.totales.porCobrar.monto} money /><Metric label="Monto recibido" value={data.totales.pagaron.monto} money /></div>{actionError && <div className="cobros-error" role="alert"><span>{actionError}</span><button className="secondary-button" type="button" onClick={() => setActionError('')}>Cerrar</button></div>}<div className="panel cobros-table-panel"><h2>POR COBRAR</h2>{selectedRows.length > 0 && <div className="cobros-selection-bar"><span><strong>{selectedRows.length}</strong> seleccionados</span><div><button className="secondary-button" type="button" onClick={() => setSelectedIds([])}>Limpiar selección</button><button className="primary-button" type="button" onClick={() => void openCollectorModal()}>Lista para cobrador</button></div></div>}<div className="table-wrap"><table className="cobros-table"><thead><tr><th><input ref={headerCheckbox} type="checkbox" checked={allSelected} onChange={toggleAll} disabled={obligations.length === 0} aria-label="Seleccionar obligaciones" /></th><th>Cliente</th><th>Préstamo</th><th>Cuota</th><th>Vencimiento</th><th>Saldo operativo</th><th>Acciones</th></tr></thead><tbody>{obligations.map(row => { const active = row.estadoPrestamo === 'ACTIVO'; return <tr key={row.planPagoId}><td><input type="checkbox" checked={selectedIds.includes(row.planPagoId)} onChange={() => toggleRow(row.planPagoId)} /></td><td><strong>{row.nombreCompleto}</strong><small>{row.identificacion} · {row.telefonoPrincipal}</small></td><td>#{row.prestamoId}</td><td>{row.numeroPago}</td><td>{formatDateOnly(row.fecha)}</td><td>{formatCRC(row.saldoPendiente)}</td><td className="cobros-actions"><button className="table-action" type="button" onClick={() => navigate('/prestamos', { state: { prestamoId: row.prestamoId } })} title="Ver préstamo" aria-label={`Ver préstamo ${row.prestamoId}`}><Eye size={16} /></button>{active && canPersonalizePlan && row.saldoPendiente > 0 && <button className="table-action" type="button" onClick={() => navigate('/pagos/registrar', { state: { prestamoId: row.prestamoId, openPersonalizePlan: true } })} title="Personalizar plan" aria-label={`Personalizar plan del préstamo ${row.prestamoId}`}><Settings2 size={16} /></button>}<button className="table-action" type="button" onClick={() => printLoan(row.prestamoId)} title="Imprimir préstamo" aria-label={`Imprimir préstamo ${row.prestamoId}`}><Printer size={16} /></button>{active && canRegisterPayment && <button className="table-action" type="button" onClick={() => navigate('/pagos/registrar', { state: { prestamoId: row.prestamoId } })} title="Registrar pago" aria-label={`Registrar pago del préstamo ${row.prestamoId}`}><HandCoins size={16} /></button>}</td></tr> })}</tbody></table></div></div><div className="panel cobros-table-panel"><h2>PAGARON</h2><div className="table-wrap"><table className="cobros-table"><thead><tr><th>Fecha</th><th>Cliente</th><th>Préstamo</th><th>Cuota</th><th>Monto recibido</th><th>Acciones</th></tr></thead><tbody>{data.pagaron.map(row => { const active = row.estadoPrestamo === 'ACTIVO'; return <tr key={row.pagoId}><td>{formatDateOnly(row.fecha)}</td><td><strong>{row.nombreCompleto}</strong><small>{row.identificacion} · {row.telefonoPrincipal}</small></td><td>#{row.prestamoId}</td><td>{row.numeroPago ?? 'Sin cuota'}</td><td>{formatCRC(row.monto)}</td><td className="cobros-actions">{active && canPersonalizePlan && <button className="table-action" type="button" onClick={() => navigate('/pagos/registrar', { state: { prestamoId: row.prestamoId, openPersonalizePlan: true } })} title="Personalizar plan" aria-label={`Personalizar plan del préstamo ${row.prestamoId}`}><Settings2 size={16} /></button>}<button className="table-action" type="button" onClick={() => printLoan(row.prestamoId)} title="Imprimir préstamo" aria-label={`Imprimir préstamo ${row.prestamoId}`}><Printer size={16} /></button>{active && canRegisterPayment && <button className="table-action" type="button" onClick={() => navigate('/pagos/registrar', { state: { prestamoId: row.prestamoId } })} title="Registrar pago" aria-label={`Registrar pago del préstamo ${row.prestamoId}`}><HandCoins size={16} /></button>}</td></tr> })}</tbody></table></div></div></>}
    {collectorModal && <div className="modal-backdrop" role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="collector-title"><h2 id="collector-title">Asignar cobrador</h2>{collectorLoading && <p>Cargando cobradores...</p>}{collectorError && <p role="alert">{collectorError}</p>}{!collectorLoading && !collectorError && <div className="modal-actions">{collectors.map(collector => <button key={collector.id} className="secondary-button" type="button" onClick={() => { setRoute({ rows: selectedRows, collector }); setCollectorModal(false) }}>{collector.nombreCompleto}</button>)}</div>}<button className="secondary-button" type="button" onClick={() => setCollectorModal(false)}>Cerrar</button></div></div>}
  </section>
}
