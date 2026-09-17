import { useEffect, useRef, useState } from 'react'
import { Eye, Search, X } from 'lucide-react'
import { Pagination } from '@/shared/components/Pagination'
import { formatCRC } from '@/shared/utils/currency'
import { formatDateOnly, isValidDateOnly, todayInCostaRica } from '@/shared/utils/date'
import { AxiosMovimientoCajaRepository } from '../infrastructure/axios-movimiento-caja.repository'
import { consultarMovimientoCaja, listarMovimientosCaja, resumirMovimientosCaja } from '../application/movimientos-caja.use-cases'
import type { MovimientoCaja, MovimientoCajaFilters, MovimientoConcepto, MovimientoTipo, MovimientosCajaPage, MovimientosCajaSummary } from '../domain/movimiento-caja.types'
import './movimientos-caja.css'

const repository = new AxiosMovimientoCajaRepository()
const today = todayInCostaRica()
const initialFilters: MovimientoCajaFilters = { fechaDesde: `${today.slice(0, 8)}01`, fechaHasta: today }
const conceptLabels: Record<MovimientoConcepto, string> = { PAGO_CLIENTE: 'Pago de cliente', DESEMBOLSO_PRESTAMO: 'Desembolso de préstamo', DESEMBOLSO_REFINANCIAMIENTO: 'Desembolso de refinanciamiento', APORTE_CAPITAL: 'Aporte de capital', RETIRO: 'Retiro', GASTO: 'Gasto', AJUSTE_ENTRADA: 'Ajuste de entrada', AJUSTE_SALIDA: 'Ajuste de salida', REVERSO: 'Reverso' }
const typeLabels: Record<MovimientoTipo, string> = { ENTRADA: 'Entrada', SALIDA: 'Salida' }
const concepts = Object.keys(conceptLabels) as MovimientoConcepto[]

export function MovimientosCajaPage() {
  const [draft, setDraft] = useState<MovimientoCajaFilters>(initialFilters)
  const [applied, setApplied] = useState<MovimientoCajaFilters>(initialFilters)
  const [pageNumber, setPageNumber] = useState(1)
  const [limit, setLimit] = useState(10)
  const [page, setPage] = useState<MovimientosCajaPage | null>(null)
  const [summary, setSummary] = useState<MovimientosCajaSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [error, setError] = useState('')
  const [summaryError, setSummaryError] = useState('')
  const [selected, setSelected] = useState<MovimientoCaja | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const listSequence = useRef(0)
  const summarySequence = useRef(0)

  useEffect(() => {
    const request = ++listSequence.current
    setLoading(true); setError('')
    void listarMovimientosCaja(repository, { ...applied, pagina: pageNumber, limite: limit }).then(result => { if (request === listSequence.current) setPage(result) }).catch(() => { if (request === listSequence.current) setError('No se pudieron cargar los movimientos de caja.') }).finally(() => { if (request === listSequence.current) setLoading(false) })
  }, [applied, pageNumber, limit])

  useEffect(() => {
    const request = ++summarySequence.current
    setSummaryLoading(true); setSummaryError('')
    void resumirMovimientosCaja(repository, applied).then(result => { if (request === summarySequence.current) setSummary(result) }).catch(() => { if (request === summarySequence.current) setSummaryError('No se pudo cargar el resumen.') }).finally(() => { if (request === summarySequence.current) setSummaryLoading(false) })
  }, [applied])

  const update = (field: keyof MovimientoCajaFilters, value: string) => setDraft(current => ({ ...current, [field]: value || undefined }))
  const consult = () => {
    if ((draft.fechaDesde && !isValidDateOnly(draft.fechaDesde)) || (draft.fechaHasta && !isValidDateOnly(draft.fechaHasta))) { setError('Ingresa fechas válidas.'); return }
    if (draft.fechaDesde && draft.fechaHasta && draft.fechaDesde > draft.fechaHasta) { setError('La fecha inicial no puede ser posterior a la fecha final.'); return }
    setPageNumber(1); setApplied({ ...draft, buscar: draft.buscar?.trim() || undefined })
  }
  const clear = () => { setDraft(initialFilters); setApplied(initialFilters); setPageNumber(1) }
  const openDetail = (movement: MovimientoCaja) => { setSelected(movement); setDetailLoading(true); setDetailError(''); void consultarMovimientoCaja(repository, movement.id).then(setSelected).catch(() => setDetailError('No se pudo cargar el detalle del movimiento.')).finally(() => setDetailLoading(false)) }

  return <section className="cash-movements-page"><div className="page-heading"><div><p className="eyebrow">FINANZAS / CAJA</p><h1>Movimientos de Caja</h1><p className="muted">Consulta y audita las entradas y salidas registradas en Caja.</p></div></div>
    <div className="panel cash-movements-filters"><label>Desde<input type="date" value={draft.fechaDesde ?? ''} onChange={event => update('fechaDesde', event.target.value)} /></label><label>Hasta<input type="date" value={draft.fechaHasta ?? ''} onChange={event => update('fechaHasta', event.target.value)} /></label><label>Tipo<select value={draft.tipo ?? ''} onChange={event => update('tipo', event.target.value)}><option value="">Todos</option><option value="ENTRADA">Entrada</option><option value="SALIDA">Salida</option></select></label><label>Concepto<select value={draft.concepto ?? ''} onChange={event => update('concepto', event.target.value)}><option value="">Todos</option>{concepts.map(concept => <option key={concept} value={concept}>{conceptLabels[concept]}</option>)}</select></label><label className="cash-movements-search">Buscar<input placeholder="Concepto, descripción o referencia" value={draft.buscar ?? ''} onChange={event => update('buscar', event.target.value)} /></label><div className="cash-movements-actions"><button className="primary-button" type="button" onClick={consult} disabled={loading}><Search size={16} aria-hidden="true" /> Consultar</button><button className="secondary-button" type="button" onClick={clear}>Limpiar</button></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}{summaryError && <p className="form-error" role="alert">{summaryError}</p>}
    <div className="cash-movements-cards">{[['Entradas', summary ? formatCRC(summary.totalEntradas) : '—'], ['Salidas', summary ? formatCRC(summary.totalSalidas) : '—'], ['Flujo neto', summary ? formatCRC(summary.balanceNeto) : '—'], ['Movimientos', page ? page.total.toLocaleString('es-CR') : '—']].map(([label, value]) => <div className="panel" key={label}><span className="muted">{label}</span><strong>{summaryLoading && label !== 'Movimientos' ? '…' : value}</strong></div>)}</div>
    {loading && !page ? <div className="panel cash-movements-state" role="status">Cargando movimientos…</div> : error && !page ? null : page?.datos.length === 0 ? <div className="panel cash-movements-state" role="status">No hay movimientos para los filtros seleccionados.</div> : page && <><div className="panel table-wrap"><table className="cash-movements-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Descripción</th><th>Referencia</th><th>Monto</th><th>Usuario</th><th>Acción</th></tr></thead><tbody>{page.datos.map(movement => <tr key={movement.id}><td>{formatDateOnly(movement.fecha)}</td><td><span className={`cash-movement-type ${movement.tipo.toLowerCase()}`}>{typeLabels[movement.tipo]}</span></td><td>{conceptLabels[movement.concepto]}</td><td>{movement.observaciones || '—'}</td><td>{reference(movement)}</td><td>{formatCRC(movement.monto)}</td><td>{movement.usuario?.nombreCompleto ?? `Usuario #${movement.usuarioId}`}</td><td><button className="table-action" type="button" onClick={() => openDetail(movement)} aria-label={`Ver detalle del movimiento ${movement.id}`} title="Ver detalle"><Eye size={16} aria-hidden="true" /> <span className="sr-only">Ver detalle</span></button></td></tr>)}</tbody></table></div><Pagination pagina={page.pagina} totalPaginas={page.totalPaginas} total={page.total} limite={page.limite} opcionesLimite={[10, 25, 50, 100]} onPageChange={setPageNumber} onLimitChange={value => { setLimit(value); setPageNumber(1) }} label="movimientos" loading={loading} /></>}
    {selected && <MovementDetail movement={selected} loading={detailLoading} error={detailError} onClose={() => setSelected(null)} />}
  </section>
}

function reference(movement: MovimientoCaja) { const values = [movement.pagoId ? `Pago #${movement.pagoId}` : '', movement.prestamoId ? `Préstamo #${movement.prestamoId}` : '', movement.refinanciamientoId ? `Refinanciamiento #${movement.refinanciamientoId}` : '', movement.movimientoReversadoId ? `Revierte movimiento #${movement.movimientoReversadoId}` : ''].filter(Boolean); return values.length ? values.join(' · ') : '—' }

function MovementDetail({ movement, loading, error, onClose }: { movement: MovimientoCaja; loading: boolean; error: string; onClose: () => void }) { return <div className="cash-movement-backdrop" role="presentation"><div className="cash-movement-modal" role="dialog" aria-modal="true" aria-labelledby="cash-movement-detail-title"><header><div><p className="eyebrow">CONSULTA</p><h2 id="cash-movement-detail-title">Movimiento #{movement.id}</h2></div><button className="table-action" type="button" onClick={onClose} aria-label="Cerrar detalle"><X size={18} /></button></header>{loading && <p className="cash-movements-state" role="status">Cargando detalle…</p>}{error && <p className="form-error" role="alert">{error}</p>}{!loading && !error && <div className="cash-movement-detail-grid"><DetailItem label="Fecha económica" value={formatDateOnly(movement.fecha)} /><DetailItem label="Registrado / fecha de creación" value={movement.fechaCreacion ? movement.fechaCreacion.replace('T', ' ').slice(0, 19) : '—'} /><DetailItem label="Tipo" value={typeLabels[movement.tipo]} /><DetailItem label="Concepto" value={conceptLabels[movement.concepto]} /><DetailItem label="Monto" value={formatCRC(movement.monto)} /><DetailItem label="Usuario / Registrado por" value={movement.usuario?.nombreCompleto ?? `Usuario #${movement.usuarioId}`} /><DetailItem label="Forma de pago" value={movement.formaPago?.nombre ?? '—'} /><DetailItem label="Descripción" value={movement.observaciones || '—'} wide />{movement.movimientoReversadoId && <DetailItem label="Referencia de reversión" value={`Reversión del movimiento #${movement.movimientoReversadoId}`} wide />}{reference(movement) !== '—' && <DetailItem label="Referencias" value={reference(movement)} wide />}</div>}</div></div> }
function DetailItem({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) { return <div className={wide ? 'cash-movement-detail-item wide' : 'cash-movement-detail-item'}><span>{label}</span><strong>{value}</strong></div> }
