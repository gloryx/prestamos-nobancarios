import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleAlert, Eye, HandCoins, Pencil, Printer, RefreshCw, RotateCcw, X } from 'lucide-react'
import { formatCRC } from '@/shared/utils/currency'
import { abrirPlanPagoPdf, listarPrestamos, obtenerPrestamo } from '../application/prestamos.use-cases'
import { listarPagosDelPrestamo, obtenerResumenDelPrestamo } from '../application/pagos.use-cases'
import { prestamoErrorMessage } from '../domain/prestamo.error'
import type { Pago, PagoResumen } from '../domain/pago.types'
import type { EstadoPrestamo, Prestamo, PrestamoFilters, PrestamoPage } from '../domain/prestamo.types'
import { AxiosPagoRepository } from '../infrastructure/axios-pago.repository'
import { AxiosPrestamoRepository } from '../infrastructure/axios-prestamo.repository'
import './prestamos-list.css'

const repository = new AxiosPrestamoRepository()
const pagoRepository = new AxiosPagoRepository()
const limite = 10
const estados: Array<{ value: EstadoPrestamo; label: string }> = [
  { value: 'ACTIVO', label: 'Activo' },
  { value: 'INCOBRABLE', label: 'Incobrable' },
  { value: 'REFINANCIADO', label: 'Refinanciado' },
  { value: 'CANCELADO', label: 'Cancelado' },
]

function displayDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value
}

function visualBalance(value: number) { return Math.max(0, value) }

function PrestamoDetailModal({ prestamoId, onClose }: { prestamoId: number; onClose: () => void }) {
  const [prestamo, setPrestamo] = useState<Prestamo | null>(null)
  const [summary, setSummary] = useState<PagoResumen | null>(null)
  const [pagos, setPagos] = useState<Pago[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showPayments, setShowPayments] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setPrestamo(null); setSummary(null); setPagos([])
    void Promise.all([obtenerPrestamo(repository, prestamoId), obtenerResumenDelPrestamo(pagoRepository, prestamoId), listarPagosDelPrestamo(pagoRepository, prestamoId)])
      .then(([detail, paymentSummary, payments]) => { if (active) { setPrestamo(detail); setSummary(paymentSummary); setPagos(payments) } })
      .catch((cause: unknown) => { if (active) setError(prestamoErrorMessage(cause)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [prestamoId])

  if (showPayments && prestamo && summary) return <PaymentsModal prestamo={prestamo} summary={summary} pagos={pagos} onClose={() => setShowPayments(false)} />
  return <div className="prestamo-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="prestamo-detail-modal" role="dialog" aria-modal="true" aria-labelledby="prestamo-detail-title">
      <div className="prestamo-detail-header"><div><p className="eyebrow">DETALLE DEL PRÉSTAMO</p><h2 id="prestamo-detail-title">Préstamo #{prestamoId}</h2></div><button className="table-action" type="button" onClick={onClose} aria-label="Cerrar detalle del préstamo"><X size={18} /></button></div>
      {loading && <div className="prestamo-modal-state" aria-live="polite">Cargando detalle, saldo y pagos...</div>}
      {!loading && error && <div className="prestamo-modal-state prestamo-modal-error" role="alert"><p>{error}</p><button className="secondary-button" type="button" onClick={onClose}>Cerrar</button></div>}
      {!loading && !error && prestamo && summary && <>
        <div className="prestamo-detail-grid"><DetailItem label="Nº" value={`#${prestamo.id}`} /><DetailItem label="Cliente" value={prestamo.cliente.nombreCompleto} /><DetailItem label="Identificación" value={prestamo.cliente.identificacion} />{prestamo.cliente.direccion && <DetailItem label="Dirección" value={prestamo.cliente.direccion} />}<DetailItem label="Fecha de alta" value={displayDate(prestamo.fechaAlta)} /><DetailItem label="Capital" value={formatCRC(prestamo.capital)} /><DetailItem label="Interés" value={formatCRC(prestamo.interes)} /><DetailItem label="Estado" value={prestamo.estado} /><DetailItem className="prestamo-detail-wide" label="Saldo pendiente" value={formatCRC(visualBalance(summary.saldoPendiente))} /></div>
        <div className="prestamo-balance-actions"><button className="secondary-button" type="button" onClick={() => setShowPayments(true)}><HandCoins size={15} /> Ver pagos realizados</button></div>
        <div className="prestamo-detail-extra"><DetailItem label="Total a pagar" value={formatCRC(summary.montoTotal)} /><DetailItem className="prestamo-detail-wide" label="Observaciones" value={prestamo.observaciones || '—'} /></div>
      </>}
      <div className="prestamo-detail-actions"><button className="secondary-button" type="button" onClick={onClose}>Cerrar</button></div>
    </div>
  </div>
}

function PaymentsModal({ prestamo, summary, pagos, onClose }: { prestamo: Prestamo; summary: PagoResumen; pagos: Pago[]; onClose: () => void }) {
  return <div className="prestamo-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="prestamo-detail-modal prestamo-payments-modal" role="dialog" aria-modal="true" aria-labelledby="prestamo-payments-title">
      <div className="prestamo-detail-header"><div><p className="eyebrow">PRÉSTAMO #{prestamo.id}</p><h2 id="prestamo-payments-title">Pagos realizados</h2></div><button className="table-action" type="button" onClick={onClose} aria-label="Cerrar pagos realizados"><X size={18} /></button></div>
      <div className="prestamo-payment-summary"><DetailItem label="Total pagado" value={formatCRC(summary.totalPagado)} /><DetailItem label="Capital pagado" value={formatCRC(summary.capitalPagado)} /><DetailItem label="Interés pagado" value={formatCRC(summary.interesPagado)} /></div>
      {!pagos.length ? <p className="prestamo-empty-payments">No se han registrado pagos para este préstamo.</p> : <div className="table-wrap prestamo-payments-table-wrap"><table className="prestamos-list-table prestamo-payments-table"><thead><tr><th>Fecha</th><th>Monto</th><th>Capital</th><th>Interés</th><th>Forma de pago</th><th>Cobrador</th></tr></thead><tbody>{pagos.map((pago) => <tr key={pago.id}><td>{displayDate(pago.fecha)}</td><td>{formatCRC(pago.monto)}</td><td>{formatCRC(pago.capitalAplicado)}</td><td>{formatCRC(pago.interesAplicado)}</td><td>{pago.formaPago?.nombre || '—'}</td><td>{pago.cobrador?.nombreCompleto || '—'}</td></tr>)}</tbody></table></div>}
      <p className="prestamo-payments-order">Ordenados por fecha ascendente e id ascendente.</p><div className="prestamo-detail-actions"><button className="secondary-button" type="button" onClick={onClose}>Volver al detalle</button></div>
    </div>
  </div>
}

function DetailItem({ label, value, className = '' }: { label: string; value: string; className?: string }) { return <div className={`prestamo-detail-item ${className}`}><span>{label}</span><strong>{value}</strong></div> }

export function PrestamosListPage() {
  const [page, setPage] = useState<PrestamoPage | null>(null); const [buscar, setBuscar] = useState(''); const [direccion, setDireccion] = useState(''); const [estado, setEstado] = useState<EstadoPrestamo | ''>(''); const [pagina, setPagina] = useState(1); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [selected, setSelected] = useState<number | null>(null)
  const load = useCallback(async () => { setLoading(true); const filters: PrestamoFilters = { pagina, limite }; if (buscar.trim()) filters.buscar = buscar.trim(); if (direccion.trim()) filters.direccion = direccion.trim(); if (estado) filters.estado = estado; try { setPage(await listarPrestamos(repository, filters)); setError('') } catch (cause) { setError(prestamoErrorMessage(cause)) } finally { setLoading(false) } }, [buscar, direccion, estado, pagina])
  useEffect(() => { void load() }, [load])
  const actionNotice = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 3500) }; const totalPages = page?.totalPaginas ?? 0
  return <section className="prestamos-list-page"><div className="page-heading"><div><p className="eyebrow">GESTIÓN</p><h1>Gestión de préstamos</h1><p className="muted">Consulta y administración de préstamos.</p></div><Link className="primary-button" to="/prestamos/nuevo">Nuevo préstamo</Link></div><div className="panel prestamos-list-filters"><label>Nombre o identificación<input value={buscar} placeholder="Nombre o identificación" onChange={(event) => { setBuscar(event.target.value); setPagina(1) }} /></label><label>Dirección<input value={direccion} placeholder="Dirección" onChange={(event) => { setDireccion(event.target.value); setPagina(1) }} /></label><label>Estado<select value={estado} onChange={(event) => { setEstado(event.target.value as EstadoPrestamo | ''); setPagina(1) }}><option value="">Todos</option>{estados.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div>{notice && <p className="prestamos-list-notice" role="status"><CircleAlert size={15} />{notice}</p>}{error && <div className="panel prestamos-list-state" role="alert"><p>{error}</p><button className="secondary-button" type="button" onClick={() => void load()}><RefreshCw size={14} /> Reintentar</button></div>}{!error && loading && <div className="panel prestamos-list-state" aria-live="polite">Cargando...</div>}{!error && !loading && !page?.datos.length && <div className="panel prestamos-list-state">No se encontraron préstamos.</div>}{!error && !loading && Boolean(page?.datos.length) && <><div className="panel table-wrap prestamos-list-table-wrap"><table className="prestamos-list-table"><colgroup><col className="prestamos-list-col-number" /><col className="prestamos-list-col-client" /><col className="prestamos-list-col-address" /><col className="prestamos-list-col-date" /><col className="prestamos-list-col-capital" /><col className="prestamos-list-col-status" /><col className="prestamos-list-col-actions" /></colgroup><thead><tr><th>N° Prest.</th><th>Cliente</th><th>Dirección</th><th>Fecha alta</th><th>Capital</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{page?.datos.map((prestamo) => <tr key={prestamo.id}><td>#{prestamo.id}</td><td><strong title={prestamo.cliente.nombreCompleto}>{prestamo.cliente.nombreCompleto}</strong><small>{prestamo.cliente.identificacion}</small></td><td><span className="prestamos-list-address" title={prestamo.cliente.direccion ?? undefined}>{prestamo.cliente.direccion || '—'}</span></td><td>{displayDate(prestamo.fechaAlta)}</td><td>{formatCRC(prestamo.capital)}</td><td><span className={`prestamo-status prestamo-status-${prestamo.estado.toLowerCase()}`}>{prestamo.estado}</span></td><td><div className="prestamos-list-actions"><button className="table-action" type="button" onClick={() => setSelected(prestamo.id)} aria-label="Ver préstamo" title="Ver préstamo"><Eye size={15} /></button><button className="table-action" type="button" disabled={prestamo.estado === 'CANCELADO'} onClick={() => actionNotice('La edición del préstamo estará disponible próximamente.')} aria-label="Editar préstamo" title="Editar préstamo"><Pencil size={15} /></button><button className="table-action" type="button" onClick={() => void abrirPlanPagoPdf(repository, prestamo.id).catch((cause) => actionNotice(`No se pudo abrir el plan de pago: ${prestamoErrorMessage(cause)}`))} aria-label="Imprimir plan de pago" title="Imprimir plan de pago"><Printer size={15} /></button><button className="table-action" type="button" disabled={prestamo.estado === 'REFINANCIADO' || prestamo.estado === 'CANCELADO'} onClick={() => actionNotice('El cambio de estado estará disponible próximamente.')} aria-label="Cambiar estado" title="Cambiar estado"><RotateCcw size={15} /></button></div></td></tr>)}</tbody></table></div><div className="prestamos-list-pagination"><button className="secondary-button" type="button" disabled={pagina <= 1} onClick={() => setPagina((value) => value - 1)}>Anterior</button><span>Página {page?.pagina ?? pagina} de {totalPages} ({page?.total ?? 0} préstamos)</span><button className="secondary-button" type="button" disabled={pagina >= totalPages} onClick={() => setPagina((value) => value + 1)}>Siguiente</button></div></>}{selected !== null && <PrestamoDetailModal prestamoId={selected} onClose={() => setSelected(null)} />}</section>
}
