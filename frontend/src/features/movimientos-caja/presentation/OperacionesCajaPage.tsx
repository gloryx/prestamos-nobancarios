import axios from 'axios'
import { ArrowDownLeft, ArrowUpRight, Eye, LoaderCircle, Plus, RotateCcw, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { listFormasPago } from '@/features/formas-pago/application/formas-pago.use-cases'
import { AxiosFormaPagoRepository } from '@/features/formas-pago/infrastructure/axios-forma-pago.repository'
import { CurrencyInput } from '@/shared/components/forms/CurrencyInput'
import { Pagination } from '@/shared/components/Pagination'
import { formatCRC } from '@/shared/utils/currency'
import { formatDateOnly, isValidDateOnly, todayInCostaRica } from '@/shared/utils/date'
import { crearMovimientoManualCaja, consultarMovimientoCaja, listarMovimientosCaja, reversarMovimientoCaja } from '../application/movimientos-caja.use-cases'
import { AxiosMovimientoCajaRepository } from '../infrastructure/axios-movimiento-caja.repository'
import type { ConceptoMovimientoManual, MovimientoCaja, MovimientoCajaFilters, MovimientosCajaPage } from '../domain/movimiento-caja.types'
import './operaciones-caja.css'

const movementRepository = new AxiosMovimientoCajaRepository()
const paymentRepository = new AxiosFormaPagoRepository()
const manualConcepts: Array<{ value: ConceptoMovimientoManual; label: string; direction: 'ENTRADA' | 'SALIDA' }> = [
  { value: 'APORTE_CAPITAL', label: 'Aporte de capital', direction: 'ENTRADA' },
  { value: 'RETIRO', label: 'Retiro', direction: 'SALIDA' },
  { value: 'GASTO', label: 'Gasto', direction: 'SALIDA' },
  { value: 'AJUSTE_ENTRADA', label: 'Ajuste de entrada', direction: 'ENTRADA' },
  { value: 'AJUSTE_SALIDA', label: 'Ajuste de salida', direction: 'SALIDA' },
]
const labels = Object.fromEntries(manualConcepts.map(item => [item.value, item.label])) as Record<ConceptoMovimientoManual, string>
const today = todayInCostaRica()
const initialFilters: MovimientoCajaFilters = { fechaDesde: `${today.slice(0, 8)}01`, fechaHasta: today }
type FormState = { concepto: ConceptoMovimientoManual; monto: number | null; fecha: string; formaPagoId: string; observaciones: string }
type DetailState = { movement: MovimientoCaja; loading: boolean; error: string }

function requestError(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback
  const status = error.response?.status
  const serverMessage = error.response?.data && typeof error.response.data === 'object' && 'message' in error.response.data
    ? String(error.response.data.message)
    : ''
  if (serverMessage) return serverMessage
  if (status === 400) return 'Los datos de la operación no son válidos o el período económico no está disponible.'
  if (status === 401) return 'Tu sesión expiró. Inicia sesión nuevamente.'
  if (status === 403) return 'No tienes permisos para operar la Caja.'
  if (status === 404) return 'No se encontró la operación o la forma de pago seleccionada.'
  if (status === 409) return 'La operación ya fue procesada o existe un conflicto de idempotencia.'
  return fallback
}

function createAttemptKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `caja-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function OperacionesCajaPage() {
  const [draft, setDraft] = useState<MovimientoCajaFilters>(initialFilters)
  const [applied, setApplied] = useState<MovimientoCajaFilters>(initialFilters)
  const [pageNumber, setPageNumber] = useState(1)
  const [limit, setLimit] = useState(10)
  const [page, setPage] = useState<MovimientosCajaPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [forms, setForms] = useState<Array<{ id: number; nombre: string; activo: boolean }>>([])
  const [formsError, setFormsError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>({ concepto: 'APORTE_CAPITAL', monto: null, fecha: today, formaPagoId: '', observaciones: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [detail, setDetail] = useState<DetailState | null>(null)
  const [reversalOpen, setReversalOpen] = useState(false)
  const [reversalDate, setReversalDate] = useState(today)
  const [reversalReason, setReversalReason] = useState('')
  const [reversing, setReversing] = useState(false)
  const [reversalError, setReversalError] = useState('')
  const attemptKey = useRef<string | null>(null)
  const requestId = useRef(0)
  const updateForm = (updater: SetStateAction<FormState>) => setForm(current => {
    const next = typeof updater === 'function' ? updater(current) : updater
    if (next.concepto !== current.concepto || next.fecha !== current.fecha || next.monto !== current.monto || next.formaPagoId !== current.formaPagoId || next.observaciones !== current.observaciones) attemptKey.current = null
    return next
  })

  const requestPage = useCallback(() => {
    const current = ++requestId.current
    const listFilters = applied.concepto ? applied : { ...applied, conceptos: manualConcepts.map(item => item.value) }
    void listarMovimientosCaja(movementRepository, { ...listFilters, pagina: pageNumber, limite: limit }).then(result => {
      if (current !== requestId.current) return
      setPage(result)
    }).catch(cause => { if (current === requestId.current) setError(requestError(cause, 'No se pudieron cargar las operaciones manuales.')) }).finally(() => { if (current === requestId.current) setLoading(false) })
  }, [applied, pageNumber, limit])

  const load = useCallback(() => {
    setLoading(true); setError('')
    requestPage()
  }, [requestPage])

  useEffect(() => { requestPage() }, [requestPage])
  useEffect(() => { void listFormasPago(paymentRepository).then(result => setForms(result.filter(item => item.activo))).catch(cause => setFormsError(requestError(cause, 'No se pudieron cargar las formas de pago.'))) }, [])

  const concept = manualConcepts.find(item => item.value === form.concepto)
  const requiresPayment = form.concepto === 'APORTE_CAPITAL' || form.concepto === 'RETIRO' || form.concepto === 'GASTO'
  const isAdjustment = form.concepto === 'AJUSTE_ENTRADA' || form.concepto === 'AJUSTE_SALIDA'
  const updateFilter = (field: keyof MovimientoCajaFilters, value: string) => setDraft(current => ({ ...current, [field]: value || undefined }))
  const consult = () => {
    if ((draft.fechaDesde && !isValidDateOnly(draft.fechaDesde)) || (draft.fechaHasta && !isValidDateOnly(draft.fechaHasta)) || (draft.fechaHasta && draft.fechaHasta > today)) { setError('Ingresa un rango de fechas válido hasta hoy.'); return }
    if (draft.fechaDesde && draft.fechaHasta && draft.fechaDesde > draft.fechaHasta) { setError('La fecha inicial no puede ser posterior a la fecha final.'); return }
    setLoading(true); setError('')
    setPageNumber(1); setApplied(draft)
  }
  const changePage = (nextPage: number) => {
    if (nextPage === pageNumber) return
    setLoading(true); setError(''); setPageNumber(nextPage)
  }
  const changeLimit = (nextLimit: number) => {
    if (nextLimit === limit) return
    setLoading(true); setError(''); setLimit(nextLimit); setPageNumber(1)
  }
  const openDetail = (movement: MovimientoCaja) => {
    setDetail({ movement, loading: true, error: '' })
    void consultarMovimientoCaja(movementRepository, movement.id).then(value => setDetail({ movement: value, loading: false, error: '' })).catch(cause => setDetail(current => current ? { ...current, loading: false, error: requestError(cause, 'No se pudo cargar el detalle de la operación.') } : current))
  }
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (saving) return
    const trimmed = form.observaciones.trim()
    if (!form.fecha || !isValidDateOnly(form.fecha) || form.fecha > today) { setFormError('La fecha económica debe ser válida y no posterior a hoy.'); return }
    if (!form.monto || form.monto <= 0) { setFormError('Ingresa un monto mayor que cero.'); return }
    if (requiresPayment && !form.formaPagoId) { setFormError('Selecciona una forma de pago.'); return }
    if (isAdjustment && !trimmed) { setFormError('Las observaciones son obligatorias para los ajustes.'); return }
    if (trimmed.length > 1000) { setFormError('Las observaciones no pueden superar 1000 caracteres.'); return }
    const key = attemptKey.current ?? createAttemptKey(); attemptKey.current = key; setSaving(true); setFormError('')
    try {
      const input = { concepto: form.concepto, monto: form.monto, fecha: form.fecha, ...(form.formaPagoId ? { formaPagoId: Number(form.formaPagoId) } : {}), ...(trimmed ? { observaciones: trimmed } : {}) }
      await crearMovimientoManualCaja(movementRepository, input, key)
      attemptKey.current = null; setFormOpen(false); setForm({ concepto: 'APORTE_CAPITAL', monto: null, fecha: todayInCostaRica(), formaPagoId: '', observaciones: '' }); setPageNumber(1); load()
    } catch (cause) { setFormError(requestError(cause, 'No se pudo registrar la operación.')) } finally { setSaving(false) }
  }
  const reverse = async (event: FormEvent) => {
    event.preventDefault(); if (!detail || detail.loading || reversing) return
    const reason = reversalReason.trim()
    if (!isValidDateOnly(reversalDate) || reversalDate > today) { setReversalError('La fecha económica debe ser válida y no posterior a hoy.'); return }
    if (!reason || reason.length > 1000) { setReversalError('El motivo es obligatorio y no puede superar 1000 caracteres.'); return }
    setReversing(true); setReversalError('')
    try { await reversarMovimientoCaja(movementRepository, detail.movement.id, { fecha: reversalDate, observaciones: reason }); setReversalOpen(false); setReversalReason(''); setDetail(null); load() } catch (cause) { setReversalError(requestError(cause, 'No se pudo reversar la operación.')) } finally { setReversing(false) }
  }
  const canReverse = detail && !detail.loading && detail.movement.movimientoReversadoId == null && !detail.movement.reversiones?.length && manualConcepts.some(item => item.value === detail.movement.concepto)

  return <section className="cash-operations-page"><div className="page-heading"><div><p className="eyebrow">FINANZAS / CAJA</p><h1>Operaciones de Caja</h1><p className="muted">Registra y consulta operaciones manuales de Caja.</p></div><button className="primary-button" type="button" onClick={() => { setFormError(''); setFormOpen(true) }}><Plus size={16} /> Nueva operación</button></div>
    <div className="panel cash-operations-filters"><label>Desde<input type="date" max={today} value={draft.fechaDesde ?? ''} onChange={event => updateFilter('fechaDesde', event.target.value)} /></label><label>Hasta<input type="date" max={today} value={draft.fechaHasta ?? ''} onChange={event => updateFilter('fechaHasta', event.target.value)} /></label><label>Concepto<select value={draft.concepto ?? ''} onChange={event => updateFilter('concepto', event.target.value)}><option value="">Todos los manuales</option>{manualConcepts.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><button className="secondary-button" type="button" onClick={consult} disabled={loading}>Consultar</button></div>
     {error && <p className="form-error" role="alert">{error}</p>}{loading && !page && <div className="panel cash-operations-state" role="status">Cargando operaciones…</div>}{!loading && page && page.datos.length === 0 && <div className="panel cash-operations-state">No hay operaciones manuales para los filtros seleccionados.</div>}{page && page.datos.length > 0 && <><div className="panel table-wrap"><table className="cash-operations-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Descripción</th><th>Forma de pago</th><th>Monto</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{page.datos.map(item => { const direction = manualConcepts.find(value => value.value === item.concepto)?.direction ?? (item.tipo === 'ENTRADA' ? 'ENTRADA' : 'SALIDA'); const status = item.reversiones?.length ? 'Reversada' : 'Vigente'; return <tr key={item.id}><td>{formatDateOnly(item.fecha)}</td><td><span className={`cash-operation-sign ${direction === 'ENTRADA' ? 'in' : 'out'}`}>{direction === 'ENTRADA' ? <ArrowUpRight size={15} /> : <ArrowDownLeft size={15} />}<span>{direction === 'ENTRADA' ? 'Entrada' : 'Salida'}</span></span></td><td>{labels[item.concepto as ConceptoMovimientoManual] ?? item.concepto}</td><td>{item.observaciones?.trim() || '—'}</td><td>{item.formaPago?.nombre ?? '—'}</td><td className="cash-operation-amount">{direction === 'ENTRADA' ? '+' : '−'}{formatCRC(item.monto)}</td><td><span className="cash-operation-status">{status}</span></td><td><button className="table-action" type="button" onClick={() => openDetail(item)} aria-label={`Ver operación ${item.id}`} title="Ver detalle"><Eye size={16} /></button></td></tr> })}</tbody></table></div><Pagination pagina={page.pagina} totalPaginas={page.totalPaginas} total={page.total} limite={page.limite} opcionesLimite={[10, 25, 50, 100]} onPageChange={changePage} onLimitChange={changeLimit} label="operaciones manuales" loading={loading} /></>}
     {formOpen && <ManualModal form={form} setForm={updateForm} forms={forms} formsError={formsError} saving={saving} error={formError} onSubmit={save} onClose={() => { if (!saving) setFormOpen(false) }} concept={concept} requiresPayment={requiresPayment} isAdjustment={isAdjustment} />}
    {detail && <DetailModal detail={detail} canReverse={Boolean(canReverse)} onClose={() => setDetail(null)} onReverse={() => { setReversalDate(todayInCostaRica()); setReversalError(''); setReversalOpen(true) }} />}
    {reversalOpen && detail && <ReversalModal movement={detail.movement} date={reversalDate} reason={reversalReason} error={reversalError} saving={reversing} setDate={setReversalDate} setReason={setReversalReason} onSubmit={reverse} onClose={() => { if (!reversing) setReversalOpen(false) }} />}
  </section>
}

function ManualModal({ form, setForm, forms, formsError, saving, error, onSubmit, onClose, concept, requiresPayment, isAdjustment }: { form: FormState; setForm: Dispatch<SetStateAction<FormState>>; forms: Array<{ id: number; nombre: string; activo: boolean }>; formsError: string; saving: boolean; error: string; onSubmit: (event: FormEvent) => void; onClose: () => void; concept?: typeof manualConcepts[number]; requiresPayment: boolean; isAdjustment: boolean }) {
  return <div className="cash-operations-backdrop"><div className="cash-operations-modal" role="dialog" aria-modal="true" aria-labelledby="new-operation-title"><header><div><p className="eyebrow">CAJA</p><h2 id="new-operation-title">Nueva operación</h2></div><button className="table-action" type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></header><form onSubmit={onSubmit}><div className="cash-operations-form-grid"><label>Concepto<select value={form.concepto} onChange={event => setForm(current => ({ ...current, concepto: event.target.value as ConceptoMovimientoManual, formaPagoId: '' }))}>{manualConcepts.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Fecha económica<input type="date" max={todayInCostaRica()} value={form.fecha} onChange={event => setForm(current => ({ ...current, fecha: event.target.value }))} /></label><label>Monto<CurrencyInput required value={form.monto} onChange={value => setForm(current => ({ ...current, monto: value }))} /></label><label>Forma de pago {!requiresPayment && <span className="muted">(opcional)</span>}<select required={requiresPayment} value={form.formaPagoId} onChange={event => setForm(current => ({ ...current, formaPagoId: event.target.value }))}><option value="">Selecciona una opción</option>{forms.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label><label className="cash-operations-wide">Observaciones {isAdjustment && <span className="muted">(obligatorias para ajustes)</span>}<textarea maxLength={1000} value={form.observaciones} onChange={event => setForm(current => ({ ...current, observaciones: event.target.value }))} /></label></div><p className="cash-operations-help">{concept?.direction === 'ENTRADA' ? 'Esta operación registrará una entrada.' : 'Esta operación registrará una salida.'}</p>{formsError && <p className="form-error" role="alert">{formsError}</p>}{error && <p className="form-error" role="alert">{error}</p>}<footer><button className="secondary-button" type="button" onClick={onClose} disabled={saving}>Cancelar</button><button className="primary-button" type="submit" disabled={saving}>{saving ? <><LoaderCircle className="spin" size={16} /> Guardando…</> : 'Guardar operación'}</button></footer></form></div></div>
}

function DetailModal({ detail, canReverse, onClose, onReverse }: { detail: DetailState; canReverse: boolean; onClose: () => void; onReverse: () => void }) {
  const movement = detail.movement
  const reversed = movement.reversiones?.length ? 'Reversada' : movement.movimientoReversadoId ? 'Reverso' : 'Vigente'
  return <div className="cash-operations-backdrop"><div className="cash-operations-modal" role="dialog" aria-modal="true" aria-labelledby="operation-detail-title"><header><div><p className="eyebrow">DETALLE AUTORITATIVO</p><h2 id="operation-detail-title">Operación #{movement.id}</h2></div><button className="table-action" type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></header>{detail.loading && <p className="cash-operations-state"><LoaderCircle className="spin" size={16} /> Cargando detalle…</p>}{detail.error && <p className="form-error" role="alert">{detail.error}</p>}{!detail.loading && !detail.error && <><div className="cash-operation-detail"><span>Fecha</span><strong>{formatDateOnly(movement.fecha)}</strong><span>Concepto</span><strong>{labels[movement.concepto as ConceptoMovimientoManual] ?? movement.concepto}</strong><span>Monto</span><strong>{formatCRC(movement.monto)}</strong><span>Descripción</span><strong>{movement.observaciones?.trim() || '—'}</strong><span>Forma de pago</span><strong>{movement.formaPago?.nombre || '—'}</strong><span>Estado</span><strong>{reversed}</strong></div>{canReverse && <button className="secondary-button" type="button" onClick={onReverse}><RotateCcw size={16} /> Reversar operación</button>}{!canReverse && reversed === 'Vigente' && <p className="cash-operations-help">La acción de reversión no está disponible para este movimiento.</p>}</>}</div></div>
}

function ReversalModal({ movement, date, reason, error, saving, setDate, setReason, onSubmit, onClose }: { movement: MovimientoCaja; date: string; reason: string; error: string; saving: boolean; setDate: (value: string) => void; setReason: (value: string) => void; onSubmit: (event: FormEvent) => void; onClose: () => void }) {
  return <div className="cash-operations-backdrop"><div className="cash-operations-modal" role="dialog" aria-modal="true" aria-labelledby="reverse-operation-title"><header><div><p className="eyebrow">REVERSIÓN APPEND-ONLY</p><h2 id="reverse-operation-title">Reversar operación #{movement.id}</h2></div><button className="table-action" type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></header><div className="cash-operation-original"><strong>{formatDateOnly(movement.fecha)} · {formatCRC(movement.monto)}</strong><span>{labels[movement.concepto as ConceptoMovimientoManual] ?? movement.concepto} · {movement.observaciones?.trim() || 'Sin descripción'}</span></div><form onSubmit={onSubmit}><label>Fecha económica<input type="date" max={todayInCostaRica()} value={date} onChange={event => setDate(event.target.value)} /></label><label>Motivo<textarea required maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></label><p className="cash-operations-notice">La operación original permanecerá intacta. Esta acción agrega un movimiento de reverso; no edita ni elimina el original.</p>{error && <p className="form-error" role="alert">{error}</p>}<footer><button className="secondary-button" type="button" onClick={onClose} disabled={saving}>Cancelar</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Reversando…' : 'Confirmar reversión'}</button></footer></form></div></div>
}
