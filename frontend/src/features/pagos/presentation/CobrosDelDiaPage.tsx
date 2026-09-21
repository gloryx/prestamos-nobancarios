import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Eye, HandCoins, Printer, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatCRC } from '@/shared/utils/currency'
import { addDaysDateOnly, formatDateOnly, isValidDateOnly, todayInCostaRica } from '@/shared/utils/date'
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
    <div className="panel cobros-route-header"><div><span>Fecha</span><strong>{formatDateOnly(fecha)}</strong></div><div><span>Cobrador</span><strong>{collector.nombreCompleto}</strong></div><div><span>Cantidad</span><strong>{rows.length}</strong></div><div><span>Monto programado</span><strong>{formatCRC(rows.reduce((total, row) => total + row.montoProgramado, 0))}</strong></div></div>
    <div className="panel table-wrap cobros-route-table-wrap"><table className="cobros-route-table cobros-route-screen-table"><thead><tr><th>Cliente</th><th>Identificación</th><th>Teléfono</th><th>Dirección</th><th>Préstamo</th><th>Cuota</th><th>Monto programado</th><th>Forma de pago</th><th>Cobrado</th><th>No cobrado</th><th>Observaciones</th></tr></thead><tbody>{rows.map(row => { const note = notes[row.planPagoId]; return <tr key={row.planPagoId}><td>{row.nombreCompleto}</td><td>{row.identificacion}</td><td>{row.telefonoPrincipal || 'Sin teléfono registrado'}</td><td>{row.direccion || 'Sin dirección registrada'}</td><td>#{row.prestamoId}</td><td>{row.numeroPago}</td><td>{formatCRC(row.montoProgramado)}</td><td>{row.formaPagoNombre}</td><td><input type="checkbox" checked={note.status === 'COBRADO'} onChange={() => setStatus(row.planPagoId, 'COBRADO')} aria-label={`Cobrado: ${row.nombreCompleto}`} /></td><td><input type="checkbox" checked={note.status === 'NO_COBRADO'} onChange={() => setStatus(row.planPagoId, 'NO_COBRADO')} aria-label={`No cobrado: ${row.nombreCompleto}`} /></td><td><input type="text" value={note.observation} onChange={event => setObservation(row.planPagoId, event.target.value)} aria-label={`Observaciones: ${row.nombreCompleto}`} /></td></tr> })}</tbody></table><table className="cobros-route-table cobros-route-print-table"><thead><tr><th>CLIENTE</th><th>TELÉFONO</th><th>DIRECCIÓN</th><th>PRÉSTAMO</th><th>CUOTA</th><th>MONTO</th><th>FORMA DE PAGO</th><th>RESULTADO</th></tr></thead><tbody>{rows.map(row => <tr key={row.planPagoId}><td><strong>{row.nombreCompleto}</strong><small>ID: {row.identificacion}</small></td><td>{row.telefonoPrincipal || 'Sin teléfono registrado'}</td><td>{row.direccion || 'Sin dirección registrada'}</td><td>#{row.prestamoId}</td><td>{row.numeroPago}</td><td>{formatCRC(row.montoProgramado)}</td><td>{row.formaPagoNombre || 'Sin registrar'}</td><td><span className="cobros-route-paper-check">[ ] Cobrado</span><span className="cobros-route-paper-check">[ ] No cobrado</span></td></tr>)}</tbody></table></div>
    <section className="panel cobros-route-summary"><h2>RESUMEN DE RUTA</h2><div className="cobros-route-summary-grid"><div><span>Cantidad asignada</span><strong>{rows.length}</strong></div><div><span>Realizados</span><strong>{paidRows.length}</strong></div><div><span>No realizados</span><strong>{rows.filter(row => notes[row.planPagoId]?.status === 'NO_COBRADO').length}</strong></div><div><span>Total recibido</span><strong>{formatCRC(paidRows.reduce((total, row) => total + (row.montoPagado ?? 0), 0))}</strong></div></div><label>Observaciones generales<textarea rows={3} /></label><div className="cobros-route-signature"><span>Firma del cobrador</span><span /></div></section>
  </section>
}

export function CobrosDelDiaPage() {
  const navigate = useNavigate()
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
  const headerCheckbox = useRef<HTMLInputElement>(null)

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
  const pendingRows = data?.filas.filter(row => row.estado === 'PENDIENTE') ?? []
  const selectedRows = data?.filas.filter(row => selectedIds.includes(row.planPagoId) && row.estado === 'PENDIENTE') ?? []
  const allPendingSelected = pendingRows.length > 0 && pendingRows.every(row => selectedIds.includes(row.planPagoId))
  const toggleAll = () => setSelectedIds(allPendingSelected ? [] : pendingRows.map(row => row.planPagoId))
  const toggleRow = (id: number) => setSelectedIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])
  const changeDate = (value: string) => { setSelectedIds([]); setRoute(null); setFecha(value) }
  const openCollectorModal = async () => { setCollectorModal(true); setCollectorError(''); setCollectorLoading(true); try { setCollectors(await listUsuariosSelector(usuarioRepository)) } catch (cause) { setCollectorError(prestamoErrorMessage(cause)) } finally { setCollectorLoading(false) } }
  useEffect(() => { if (headerCheckbox.current) headerCheckbox.current.indeterminate = selectedRows.length > 0 && !allPendingSelected }, [allPendingSelected, selectedRows.length])

  if (route) return <RouteView fecha={fecha} rows={route.rows} collector={route.collector} onBack={() => setRoute(null)} />

  return <section className="cobros-page">
    <div className="page-heading"><div><p className="eyebrow">PAGOS</p><h1>Cobros del día</h1><p className="muted">Consulta operativa de cuotas programadas y pagos recibidos.</p></div><button className="secondary-button" type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15} /> Actualizar</button></div>
     <div className="cobros-toolbar" aria-label="Selector de fecha de cobro"><button className="secondary-button" type="button" onClick={() => { setSelectedIds([]); moveDate(-1) }} disabled={loading || !isValidDateOnly(fecha)} aria-label="Día anterior"><ChevronLeft size={16} /> Día anterior</button><label>Fecha de cobro<input type="date" value={fecha} onChange={event => changeDate(event.target.value)} disabled={loading} /></label><button className="secondary-button" type="button" onClick={() => changeDate(todayInCostaRica())} disabled={loading || fecha === todayInCostaRica()}>Hoy</button><button className="secondary-button" type="button" onClick={() => { setSelectedIds([]); moveDate(1) }} disabled={loading || !isValidDateOnly(fecha)} aria-label="Día siguiente">Día siguiente <ChevronRight size={16} /></button></div>
    {loading && <p className="cobros-state" role="status">Cargando cobros...</p>}
    {!loading && error && <div className="cobros-error" role="alert"><span>No se pudieron cargar los cobros.</span><button className="secondary-button" type="button" onClick={() => void load()}><RefreshCw size={14} /> Reintentar</button></div>}
    {!loading && !error && data && <>
      <div className="cobros-metrics"><Metric label="Programados" value={data.totales.cantidadProgramados} /><Metric label="Pagados" value={data.totales.cantidadPagados} /><Metric label="Pendientes" value={data.totales.cantidadPendientes} /><Metric label="Monto programado" value={data.totales.montoProgramado} money /><Metric label="Monto recibido" value={data.totales.montoRecibido} money /></div>
       {data.filas.length === 0 ? <p className="cobros-empty" role="status">No hay cobros programados para {formatDateOnly(fecha)}.</p> : <><div className="panel cobros-table-panel">{selectedRows.length > 0 && <div className="cobros-selection-bar"><span><strong>{selectedRows.length}</strong> seleccionados · {formatCRC(selectedRows.reduce((total, row) => total + row.montoProgramado, 0))}</span><div><button className="secondary-button" type="button" onClick={() => setSelectedIds([])}>Limpiar selección</button><button className="primary-button" type="button" onClick={() => void openCollectorModal()}>Lista para cobrador</button></div></div>}<div className="table-wrap"><table className="cobros-table"><caption>Cobros del {formatDateOnly(fecha)}</caption><thead><tr><th><input ref={headerCheckbox} type="checkbox" checked={allPendingSelected} onChange={toggleAll} disabled={pendingRows.length === 0} aria-label="Seleccionar todos los cobros pendientes visibles" /></th><th>Cliente / contacto</th><th>Préstamo</th><th>Cuota</th><th>Fecha de vencimiento</th><th>Monto programado</th><th>Monto recibido</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{data.filas.map(row => <tr key={row.planPagoId}><td><input type="checkbox" checked={selectedIds.includes(row.planPagoId)} onChange={() => toggleRow(row.planPagoId)} disabled={row.estado !== 'PENDIENTE'} aria-label={`Seleccionar cobro de ${row.nombreCompleto}`} /></td><td><strong>{row.nombreCompleto}</strong><small>{row.identificacion} · {row.telefonoPrincipal}</small></td><td>#{row.prestamoId}</td><td>{row.numeroPago}</td><td>{formatDateOnly(row.fecha)}</td><td>{formatCRC(row.montoProgramado)}</td><td>{formatCRC(row.montoPagado)}</td><td><span className={`cobros-status cobros-status-${row.estado.toLowerCase()}`}>{row.estado}</span></td><td className="cobros-actions"><button className="table-action" type="button" onClick={() => openLoan(row)} title="Ver préstamo" aria-label={`Ver préstamo ${row.prestamoId}`}><Eye size={16} /></button>{row.estado === 'PENDIENTE' && <button className="table-action" type="button" onClick={() => navigate('/pagos/registrar', { state: { prestamoId: row.prestamoId } })} title="Registrar pago" aria-label={`Registrar pago del préstamo ${row.prestamoId}`}><HandCoins size={16} /></button>}</td></tr>)}</tbody></table></div></div>{collectorModal && <div className="cobros-modal-backdrop" role="presentation"><div className="cobros-modal" role="dialog" aria-modal="true" aria-labelledby="cobros-collector-title"><h2 id="cobros-collector-title">Elegir cobrador</h2>{collectorLoading ? <p role="status">Cargando usuarios activos...</p> : collectorError ? <p className="form-error" role="alert">{collectorError}</p> : collectors.length === 0 ? <p className="form-note">No hay usuarios activos disponibles.</p> : <label>Usuario activo<select defaultValue="" onChange={event => { const collector = collectors.find(item => item.id === Number(event.target.value)); if (collector) { setRoute({ rows: selectedRows, collector }); setCollectorModal(false) } }}><option value="" disabled>Seleccioná un usuario</option>{collectors.map(collector => <option key={collector.id} value={collector.id}>{collector.nombreCompleto}</option>)}</select></label>}<button className="secondary-button" type="button" onClick={() => setCollectorModal(false)}>Cancelar</button></div></div>}</>}
    </>}
  </section>
}
