import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Printer, RefreshCw, Search, X } from 'lucide-react'
import Swal from 'sweetalert2'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/app/providers/auth-context'
import { CurrencyInput } from '@/shared/components/forms/CurrencyInput'
import { confirmAction } from '@/shared/utils/sweet-alert'
import { formatCRC } from '@/shared/utils/currency'
import { ajustarMontoCuota, abrirEstadoCuentaPdf, listarPlanPago, listarPrestamos, obtenerPrestamo } from '@/features/prestamos/application/prestamos.use-cases'
import { listarPagosDelPrestamo, obtenerResumenDelPrestamo, registrarPago } from '@/features/prestamos/application/pagos.use-cases'
import { AxiosPrestamoRepository } from '@/features/prestamos/infrastructure/axios-prestamo.repository'
import { AxiosPagoRepository } from '@/features/prestamos/infrastructure/axios-pago.repository'
import { listFormasPago } from '@/features/formas-pago/application/formas-pago.use-cases'
import { AxiosFormaPagoRepository } from '@/features/formas-pago/infrastructure/axios-forma-pago.repository'
import { listUsuariosSelector } from '@/features/usuarios/application/usuarios.use-cases'
import { AxiosUsuarioRepository } from '@/features/usuarios/infrastructure/axios-usuario.repository'
import { prestamoErrorMessage } from '@/features/prestamos/domain/prestamo.error'
import type { Pago, PagoRegistrado, PagoResumen } from '@/features/prestamos/domain/pago.types'
import type { PlanPago, Prestamo, PrestamoFilters, PrestamoPage } from '@/features/prestamos/domain/prestamo.types'
import type { FormaPago } from '@/features/formas-pago/domain/forma-pago.types'
import type { UsuarioSelector } from '@/features/usuarios/domain/usuario.types'
import './registrar-pago.css'

const prestamoRepository = new AxiosPrestamoRepository(); const pagoRepository = new AxiosPagoRepository(); const formaRepository = new AxiosFormaPagoRepository(); const usuarioRepository = new AxiosUsuarioRepository()
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const dateLabel = (value: string) => value ? value.slice(0, 10).split('-').reverse().join('/') : '—'; const money = (value: number) => formatCRC(value)
const cobranzaLabel = (value: Prestamo['indicadorCobranza']) => value === 'AL_DIA' ? 'AL DÍA' : value.replace('_', ' ')
type PaymentValidationErrors = Partial<Record<'loan' | 'installment' | 'date' | 'amount' | 'paymentMethod' | 'collector', string>>
const hasAtMostTwoDecimals = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) <= Number.EPSILON * Math.max(1, Math.abs(value * 100))

function useLocalModalAccessibility(open: boolean, onClose: () => void, busy: boolean) {
  const openerRef = useRef<HTMLElement | null>(null)
  const closeRef = useRef(onClose)
  const busyRef = useRef(busy)
  closeRef.current = onClose
  busyRef.current = busy

  useEffect(() => {
    if (!open) return
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialogs = Array.from(document.querySelectorAll<HTMLElement>('.payment-modal'))
    const dialog = dialogs[dialogs.length - 1]
    if (!dialog) return
    const title = dialog.querySelector('h2')
    if (title) {
      if (!title.id && title.textContent?.startsWith('Historial')) title.id = 'payment-history-title'
      if (!title.id && title.textContent?.startsWith('Ajustar')) title.id = `payment-adjustment-title-${title.textContent.match(/\d+/)?.[0] ?? 'current'}`
      if (title.id) dialog.setAttribute('aria-labelledby', title.id)
    }
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-modal', 'true')
    Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).filter(button => !button.textContent?.trim()).forEach(button => button.setAttribute('aria-label', 'Cerrar'))
    const first = dialog.querySelector<HTMLElement>('input, select, textarea') ?? dialog.querySelector<HTMLElement>('button')
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []).filter(element => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true')
    first?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!busyRef.current && !Swal.isVisible()) {
          event.preventDefault()
          closeRef.current()
        }
        return
      }
      if (event.key !== 'Tab') return
      const elements = focusable()
      if (!elements.length) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const current = document.activeElement
      const index = elements.indexOf(current as HTMLElement)
      if (index === -1) {
        event.preventDefault()
        elements[0].focus()
      } else if (event.shiftKey && index === 0) {
        event.preventDefault()
        elements[elements.length - 1].focus()
      } else if (!event.shiftKey && index === elements.length - 1) {
        event.preventDefault()
        elements[0].focus()
      }
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target
      if ((busyRef.current || Swal.isVisible()) && target instanceof Element) {
        const button = target.closest('button')
        if (button && (button.getAttribute('aria-label') === 'Cerrar' || button.textContent?.trim() === 'Cancelar')) { event.preventDefault(); event.stopPropagation() }
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    dialog.addEventListener('click', handleClick, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      dialog.removeEventListener('click', handleClick, true)
      openerRef.current?.focus()
    }
  }, [open])
}

function LoanSelector({ onSelect, onClose }: { onSelect: (loan: Prestamo) => void; onClose: () => void }) {
  const [page, setPage] = useState<PrestamoPage | null>(null); const [buscar, setBuscar] = useState(''); const [direccion, setDireccion] = useState(''); const [pagina, setPagina] = useState(1); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const requestId = useRef(0)
  const load = useCallback(async () => { const currentRequestId = ++requestId.current; setLoading(true); setError(''); const filters: PrestamoFilters = { pagina, limite: 10, estado: 'ACTIVO' }; if (buscar.trim()) filters.buscar = buscar.trim(); if (direccion.trim()) filters.direccion = direccion.trim(); try { const nextPage = await listarPrestamos(prestamoRepository, filters); if (currentRequestId !== requestId.current) return; setPage(nextPage) } catch (cause) { if (currentRequestId === requestId.current) { setPage(null); setError(prestamoErrorMessage(cause)) } } finally { if (currentRequestId === requestId.current) setLoading(false) } }, [buscar, direccion, pagina])
  useEffect(() => { const timer = window.setTimeout(() => void load(), 300); return () => window.clearTimeout(timer) }, [load])
  const clearFilters = () => { setBuscar(''); setDireccion(''); setPagina(1) }; const hasResults = Boolean(page?.datos.length)
  const balances = Object.fromEntries((page?.datos ?? []).map(loan => [loan.id, loan.capitalPendiente ?? 0] as const)); useLocalModalAccessibility(true, onClose, loading)
   return <div className="payment-modal-backdrop" role="presentation"><div className="payment-modal loan-selector-modal" role="dialog" aria-modal="true" aria-labelledby="loan-selector-title"><header className="payment-modal-header"><h2 id="loan-selector-title">Seleccionar préstamo activo</h2><button className="table-action" type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></header><div className="loan-selector-filters"><label>Cliente<input value={buscar} placeholder="Nombre o identificación" onChange={event => { setBuscar(event.target.value); setPagina(1) }} /></label><label>Dirección<input value={direccion} placeholder="Buscar dirección" onChange={event => { setDireccion(event.target.value); setPagina(1) }} /></label><button className="secondary-button loan-selector-clear" type="button" onClick={clearFilters} disabled={!buscar && !direccion}>Limpiar filtros</button></div>{loading && <p className="payment-state" role="status">Cargando préstamos...</p>}{!loading && error && <div className="payment-state payment-error" role="alert"><p>No se pudieron cargar los préstamos.</p><button className="secondary-button" type="button" onClick={() => void load()}><RefreshCw size={14} /> Reintentar</button></div>}{!loading && !error && !hasResults && <p className="payment-empty" role="status">No se encontraron préstamos activos con esos filtros.</p>}{!loading && !error && hasResults && <><div className="table-wrap loan-table-wrap"><table><thead><tr><th>Nº / ID</th><th>Identificación</th><th>Cliente</th><th>Dirección</th><th>Capital pendiente</th><th>Estado</th><th /></tr></thead><tbody>{page?.datos.map(item => <tr key={item.id}><td>#{item.id}</td><td>{item.cliente.identificacion}</td><td>{item.cliente.nombreCompleto}</td><td>{item.cliente.direccion || '—'}</td><td>{money(balances[item.id] ?? 0)}</td><td><span className="prestamo-status prestamo-status-activo">ACTIVO</span></td><td><button className="text-button" type="button" onClick={() => { onSelect(item); onClose() }}>Seleccionar</button></td></tr>)}</tbody></table></div><div className="payment-pagination"><button className="secondary-button" type="button" disabled={pagina <= 1 || loading} onClick={() => setPagina(current => current - 1)}>Anterior</button><span>Página {page?.pagina ?? pagina} de {page?.totalPaginas ?? 1}</span><button className="secondary-button" type="button" disabled={pagina >= (page?.totalPaginas ?? 1) || loading} onClick={() => setPagina(current => current + 1)}>Siguiente</button></div></>}</div></div>
}

export function History({ prestamo, onClose }: { prestamo: Prestamo; onClose: () => void }) { const [items, setItems] = useState<Pago[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(false); const load = useCallback(async () => { setLoading(true); setError(false); try { setItems(await listarPagosDelPrestamo(pagoRepository, prestamo.id)) } catch { setItems([]); setError(true) } finally { setLoading(false) } }, [prestamo.id]); useEffect(() => { void load() }, [load]); useLocalModalAccessibility(true, onClose, loading); return <div className="payment-modal-backdrop"><div className="payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-history-title"><header className="payment-modal-header"><h2 id="payment-history-title">Historial de pagos</h2><button className="table-action" type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></header>{loading && <p className="payment-state" role="status">Cargando historial...</p>}{!loading && error && <div className="payment-state payment-error" role="alert"><p>No se pudo cargar el historial de pagos.</p><button className="secondary-button" type="button" onClick={() => void load()}>Reintentar</button></div>}{!loading && !error && !items.length && <p className="payment-empty" role="status">No hay pagos registrados para este préstamo.</p>}{!loading && !error && items.length > 0 && <table><thead><tr><th>Fecha</th><th>Monto</th><th>Cuota</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td>{dateLabel(item.fecha)}</td><td>{money(item.monto)}</td><td>{item.numeroCuota ? `N° ${item.numeroCuota}` : '—'}</td></tr>)}</tbody></table>}</div></div> }
function AdjustmentModal({ item, onClose, onAdjusted }: { item: PlanPago; onClose: () => void; onAdjusted: () => Promise<void> }) {
  const [amount, setAmount] = useState<number | null>(item.montoProgramado)
  const [date, setDate] = useState(item.fechaVencimiento.slice(0, 10))
  const originalDate = item.fechaVencimiento.slice(0, 10)
  const amountId = `payment-adjustment-amount-${item.id}`
  const dateId = `payment-adjustment-date-${item.id}`
  const dateErrorId = `${dateId}-error`
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(new Date(`${date}T00:00:00.000Z`).getTime()) && new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) === date
  const dateError = !date ? 'Ingresa la fecha de la cuota.' : !validDate ? 'Ingresa una fecha válida.' : ''
  const valid = amount != null && amount > 0 && validDate
  useLocalModalAccessibility(true, onClose, Swal.isVisible())
  return <div className="payment-modal-backdrop"><div className="payment-modal adjustment-modal" role="dialog" aria-modal="true" aria-labelledby={`payment-adjustment-title-${item.id}`}>
    <h2 className="adjustment-title" id={`payment-adjustment-title-${item.id}`}>Ajustar cuota N° {item.numeroPago}</h2>
    <div className="adjustment-summary">
      <p><span>Monto actual</span><strong>{money(item.montoProgramado)}</strong></p>
      <p><span>Diferencia</span><strong>{amount == null ? '—' : money(amount - item.montoProgramado)}</strong></p>
    </div>
    <div className="adjustment-fields">
      <label className="adjustment-field" htmlFor={amountId}>Nuevo monto<CurrencyInput id={amountId} value={amount} onChange={setAmount} /></label>
      <label className="adjustment-field" htmlFor={dateId}>Fecha de la cuota<input id={dateId} type="date" value={date} onChange={event => setDate(event.target.value)} aria-invalid={Boolean(dateError)} aria-describedby={dateError ? dateErrorId : undefined} />{dateError && <span className="field-error" id={dateErrorId}>{dateError}</span>}</label>
    </div>
    <div className="payment-actions adjustment-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancelar</button><button className="primary-button" type="button" disabled={!valid} onClick={async () => { if (amount == null || !validDate) return; await confirmAction({ title: '¿Ajustar cuota?', text: `Nuevo monto: ${money(amount)}`, confirmButtonText: 'Sí, ajustar', loadingTitle: 'Ajustando cuota...', successTitle: 'Cuota ajustada', errorTitle: 'No se pudo ajustar la cuota', getErrorMessage: prestamoErrorMessage, action: async () => { await ajustarMontoCuota(prestamoRepository, item.id, amount === item.montoProgramado ? undefined : amount, date === originalDate ? undefined : date) } }); await onAdjusted() }}>Ajustar</button></div>
  </div></div>
}

export function RegistrarPagoPage() {
  const location = useLocation(); const navigationState = location.state as unknown; const navigationPrestamoId = typeof navigationState === 'object' && navigationState !== null && 'prestamoId' in navigationState && typeof navigationState.prestamoId === 'number' && Number.isInteger(navigationState.prestamoId) && navigationState.prestamoId > 0 ? navigationState.prestamoId : null
  const { user } = useAuth(); const allowed = user?.rol === 'ADMINISTRADOR' || user?.rol === 'VENDEDOR'; const canAdjust = user?.rol === 'ADMINISTRADOR'; const [prestamo, setPrestamo] = useState<Prestamo | null>(null); const [summary, setSummary] = useState<PagoResumen | null>(null); const [plan, setPlan] = useState<PlanPago[]>([]); const [selected, setSelected] = useState<PlanPago | null>(null); const [adjusting, setAdjusting] = useState<PlanPago | null>(null); const [formas, setFormas] = useState<FormaPago[]>([]); const [cobradores, setCobradores] = useState<UsuarioSelector[]>([]); const [formaPagoId, setFormaPagoId] = useState(''); const [cobradorId, setCobradorId] = useState(''); const [observaciones, setObservaciones] = useState(''); const [selectorOpen, setSelectorOpen] = useState(false); const [historyOpen, setHistoryOpen] = useState(false); const [monto, setMonto] = useState<number | null>(null); const [, setRegistered] = useState<PagoRegistrado | null>(null); const [fecha, setFecha] = useState(today); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [catalogError, setCatalogError] = useState(''); const [validationErrors, setValidationErrors] = useState<PaymentValidationErrors>({}); const submittingRef = useRef(false); const loadRequestId = useRef(0); const loanRef = useRef<HTMLButtonElement>(null); const installmentRef = useRef<HTMLButtonElement>(null); const dateRef = useRef<HTMLInputElement>(null); const amountRef = useRef<HTMLInputElement>(null); const paymentMethodRef = useRef<HTMLSelectElement>(null); const collectorRef = useRef<HTMLSelectElement>(null)
  useEffect(() => { void Promise.all([listFormasPago(formaRepository), listUsuariosSelector(usuarioRepository)]).then(([nextFormas, nextUsers]) => { setFormas(nextFormas.filter(item => item.activo)); setCobradores(nextUsers.filter(item => item.activo !== false)) }).catch(cause => setCatalogError(prestamoErrorMessage(cause))) }, [])
  useEffect(() => { setCobradorId(''); setObservaciones('') }, [selected])
  const closeRegistration = useCallback(() => { if (submittingRef.current || loading) return; setSelected(null); setMonto(null) }, [loading])
  useLocalModalAccessibility(Boolean(selected), closeRegistration, loading || submittingRef.current)
  const selectLoan = useCallback(async (loan: Prestamo) => { const currentRequestId = ++loadRequestId.current; setPrestamo(loan); setSummary(null); setPlan([]); setFormaPagoId(String(loan.formaPagoId)); setCobradorId(''); setObservaciones(''); setError(''); setLoading(true); try { const [nextSummary, nextPlan] = await Promise.all([obtenerResumenDelPrestamo(pagoRepository, loan.id), listarPlanPago(prestamoRepository, loan.id)]); if (currentRequestId !== loadRequestId.current) return; setSummary(nextSummary); setPlan(nextPlan); setSelected(null); setMonto(null) } catch (cause) { if (currentRequestId === loadRequestId.current) setError(prestamoErrorMessage(cause)) } finally { if (currentRequestId === loadRequestId.current) setLoading(false) } }, [])
  useEffect(() => { if (navigationPrestamoId === null) return; const currentRequestId = ++loadRequestId.current; setLoading(true); setError(''); void obtenerPrestamo(prestamoRepository, navigationPrestamoId).then(loan => { if (currentRequestId === loadRequestId.current) void selectLoan(loan) }).catch(cause => { if (currentRequestId === loadRequestId.current) { setError(prestamoErrorMessage(cause)); setLoading(false) } }) }, [navigationPrestamoId, selectLoan])
  const refresh = async () => { if (!prestamo) return; const [loan, nextSummary, nextPlan] = await Promise.all([obtenerPrestamo(prestamoRepository, prestamo.id), obtenerResumenDelPrestamo(pagoRepository, prestamo.id), listarPlanPago(prestamoRepository, prestamo.id)]); setPrestamo(loan); setSummary(nextSummary); setPlan(nextPlan) }
  const notifyRefreshFailure = async () => { const result = await Swal.fire({ title: 'Pago registrado', text: 'El pago se registró correctamente, pero no fue posible actualizar toda la información en pantalla.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Actualizar información', cancelButtonText: 'Cerrar', reverseButtons: true }); if (!result.isConfirmed || !prestamo) return; setLoading(true); try { await refresh(); await Swal.fire({ title: 'Información actualizada', text: 'Los datos del préstamo se actualizaron correctamente.', icon: 'success', confirmButtonText: 'Aceptar' }) } catch { await notifyRefreshFailure() } finally { setLoading(false) } }
  const submit = async (event: FormEvent) => { event.preventDefault(); if (submittingRef.current || loading) return; const nextErrors: PaymentValidationErrors = {}; if (!prestamo) nextErrors.loan = 'Selecciona un préstamo.'; if (!selected) nextErrors.installment = 'Selecciona una cuota.'; if (!fecha.trim()) nextErrors.date = 'Ingresa la fecha del pago.'; if (monto == null || !Number.isFinite(monto) || monto <= 0) nextErrors.amount = 'Ingresa un monto mayor que cero.'; else if (!hasAtMostTwoDecimals(monto)) nextErrors.amount = 'El monto admite como máximo dos decimales.'; if (!formaPagoId) nextErrors.paymentMethod = 'Selecciona una forma de pago.'; if (!cobradorId) nextErrors.collector = 'Selecciona un cobrador.'; setValidationErrors(nextErrors); const firstInvalid = nextErrors.loan ? loanRef.current : nextErrors.installment ? installmentRef.current : nextErrors.date ? dateRef.current : nextErrors.amount ? amountRef.current : nextErrors.paymentMethod ? paymentMethodRef.current : nextErrors.collector ? collectorRef.current : null; if (firstInvalid) { firstInvalid.focus(); return } submittingRef.current = true; setError(''); setLoading(true); try { const result = await registrarPago(pagoRepository, { prestamoId: prestamo!.id, planPagoId: selected!.id, monto: monto!, fecha, formaPagoId: Number(formaPagoId), cobradorId: Number(cobradorId), observaciones: observaciones.trim() || null }); setRegistered(result); setSelected(null); setMonto(null); try { await refresh(); await Swal.fire({ title: 'Pago registrado', text: 'El pago se registró correctamente.', icon: 'success', confirmButtonText: 'Aceptar' }) } catch { await notifyRefreshFailure() } } catch (cause) { setError(prestamoErrorMessage(cause)) } finally { setLoading(false); submittingRef.current = false } }
  const firstPending = plan.find(item => item.estado !== 'PAGADA')
  if (!allowed) return <section className="registrar-pago-page"><p className="form-error">No tienes permisos para registrar pagos.</p></section>
  return <section className="registrar-pago-page"><div className="page-heading"><div><p className="eyebrow">PAGOS</p><h1>Registrar pago</h1></div></div>{catalogError && <p className="form-error">{catalogError}</p>}{error && <p className="form-error">{error}</p>}<form className="registrar-pago-form" onSubmit={event => void submit(event)}><div className="payment-block"><div className="payment-block-heading"><h2>Préstamo</h2><button className="secondary-button" id="payment-loan" ref={loanRef} type="button" aria-invalid={Boolean(validationErrors.loan)} aria-describedby={validationErrors.loan ? 'payment-loan-error' : undefined} onClick={() => setSelectorOpen(true)}><Search size={15} /> {prestamo ? 'Cambiar préstamo' : 'Seleccionar préstamo'}</button></div>{prestamo ? <div className="selected-loan"><strong>{prestamo.cliente.nombreCompleto}</strong><span>#{prestamo.id}</span><span>Fecha límite: {dateLabel(prestamo.fechaLimiteContractual)}</span><span>Capital: {money(prestamo.capital)}</span><span>Interés: {money(prestamo.interes)}</span><span>Saldo pendiente: {summary ? money(summary.saldoPendiente) : '—'}</span><span className="payment-collection-situation">{cobranzaLabel(prestamo.indicadorCobranza)}</span></div> : loading ? <p className="payment-placeholder" role="status">Cargando préstamo...</p> : <p className="payment-placeholder">Selecciona un préstamo activo para comenzar.</p>}{validationErrors.loan && <p className="field-error" id="payment-loan-error">{validationErrors.loan}</p>}</div>{prestamo && prestamo.indicadorCobranza === 'PLAZO_CUMPLIDO' && summary && <p className="payment-situation-notice">El plazo contractual se cumplió y queda un saldo de {money(summary.saldoPendiente)}. Puedes registrar el pago normalmente.</p>}{prestamo && <div className="payment-block"><div className="payment-block-heading"><h2>Plan de pagos</h2><button className="secondary-button" type="button" onClick={() => void abrirEstadoCuentaPdf(prestamoRepository, prestamo.id)}><Printer size={15} /> Imprimir estado de cuenta</button></div><p className="payment-placeholder">El pago debe registrarse en la primera cuota pendiente o parcial. El monto puede ser menor, igual o mayor que la cuota, siempre que no supere el saldo pendiente del préstamo.</p>{loading ? <p className="payment-state">Cargando...</p> : <table className="payment-plan-table"><thead><tr><th>N°</th><th>Fecha</th><th>Monto pendiente</th><th>Monto pagado</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{plan.map(item => { const selectable = firstPending?.id === item.id; return <tr key={item.id}><td>{item.numeroPago}</td><td>{dateLabel(item.fechaVencimiento)}</td><td>{money(item.montoPendiente)}</td><td>{money(item.montoPagado ?? 0)}</td><td><span className={item.estado === 'PAGADA' ? 'estado-pagada' : item.estado === 'PENDIENTE' ? 'estado-pendiente' : ''}>{item.estado}</span></td><td>{selectable && <button className="text-button" type="button" ref={selectable ? installmentRef : undefined} id={selectable ? 'payment-installment' : undefined} aria-invalid={selectable && Boolean(validationErrors.installment)} aria-describedby={selectable && validationErrors.installment ? 'payment-installment-error' : undefined} onClick={() => { setSelected(item); setMonto(item.montoPendiente) }}>Seleccionar</button>}{canAdjust && <button className="text-button" type="button" onClick={() => setAdjusting(item)}>Editar</button>}</td></tr> })}</tbody></table>}{validationErrors.installment && <p className="field-error" id="payment-installment-error">{validationErrors.installment}</p>}</div>}{selected && <div className="payment-modal-backdrop" role="presentation"><div className="payment-modal payment-registration-modal" role="dialog" aria-modal="true" aria-labelledby="payment-registration-title"><div className="payment-modal-header"><h2 id="payment-registration-title">Registrar pago de cuota N° {selected.numeroPago}</h2></div><div className="payment-fields"><label htmlFor="payment-date">Fecha del pago<input id="payment-date" ref={dateRef} type="date" value={fecha} onChange={event => setFecha(event.target.value)} required aria-invalid={Boolean(validationErrors.date)} aria-describedby={validationErrors.date ? 'payment-date-error' : undefined} />{validationErrors.date && <span className="field-error" id="payment-date-error">{validationErrors.date}</span>}</label><label htmlFor="payment-amount">Monto<input id="payment-amount" ref={amountRef} type="number" min="0.01" step="0.01" value={monto ?? ''} onChange={event => setMonto(Number(event.target.value))} aria-invalid={Boolean(validationErrors.amount)} aria-describedby={validationErrors.amount ? 'payment-amount-error' : undefined} />{validationErrors.amount && <span className="field-error" id="payment-amount-error">{validationErrors.amount}</span>}</label><label htmlFor="payment-method">Forma de pago<select id="payment-method" ref={paymentMethodRef} value={formaPagoId} onChange={event => setFormaPagoId(event.target.value)} required aria-invalid={Boolean(validationErrors.paymentMethod)} aria-describedby={validationErrors.paymentMethod ? 'payment-method-error' : undefined}><option value="">Seleccionar</option>{formas.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>{validationErrors.paymentMethod && <span className="field-error" id="payment-method-error">{validationErrors.paymentMethod}</span>}</label><label htmlFor="payment-collector">Cobrador<select id="payment-collector" ref={collectorRef} value={cobradorId} onChange={event => setCobradorId(event.target.value)} required aria-invalid={Boolean(validationErrors.collector)} aria-describedby={validationErrors.collector ? 'payment-collector-error' : undefined}><option value="">Seleccionar</option>{cobradores.map(item => <option key={item.id} value={item.id}>{item.nombreCompleto}</option>)}</select>{validationErrors.collector && <span className="field-error" id="payment-collector-error">{validationErrors.collector}</span>}</label><label className="payment-wide" htmlFor="payment-observations">Observaciones<textarea id="payment-observations" value={observaciones} onChange={event => setObservaciones(event.target.value)} rows={3} /></label></div><div className="payment-actions"><button className="secondary-button" type="button" onClick={() => { setSelected(null); setMonto(null) }}>Cancelar</button><button className="primary-button" type="submit" disabled={loading || !formaPagoId}>Registrar pago</button></div></div></div>}</form>{selectorOpen && <LoanSelector onSelect={loan => void selectLoan(loan)} onClose={() => setSelectorOpen(false)} />}{historyOpen && prestamo && <History prestamo={prestamo} onClose={() => setHistoryOpen(false)} />}{adjusting && <AdjustmentModal item={adjusting} onClose={() => { setAdjusting(null) }} onAdjusted={async () => { setAdjusting(null); await refresh() }} />}</section>
}
