import { useCallback, useEffect, useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import type { FormEvent } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { listarClientes } from '@/features/clientes/application/clientes.use-cases'
import { clienteErrorMessage } from '@/features/clientes/domain/cliente.error'
import type { Cliente, ClienteFilters, ClientePage } from '@/features/clientes/domain/cliente.types'
import { AxiosClienteRepository } from '@/features/clientes/infrastructure/axios-cliente.repository'
import type { FormaPago } from '@/features/formas-pago/domain/forma-pago.types'
import type { Periodicidad } from '@/features/periodicidades-pago/domain/periodicidad-pago.types'
import { CurrencyInput } from '@/shared/components/forms/CurrencyInput'
import { abrirPlanPagoPdf, crearPrestamo } from '../application/prestamos.use-cases'
import { PrestamoError, prestamoErrorMessage } from '../domain/prestamo.error'
import type { PrestamoInput } from '../domain/prestamo.types'
import { AxiosPrestamoRepository } from '../infrastructure/axios-prestamo.repository'

const schema = z.object({
  clienteId: z.number().int().positive('Seleccioná un cliente.'),
  fechaAlta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ingresá una fecha válida.').refine((value) => {
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  }, 'Ingresá una fecha válida.'),
  capital: z.number().positive('El capital debe ser mayor que cero.'),
  interes: z.number().min(0, 'El interés no puede ser negativo.'),
  periodicidadPagoId: z.number().int().positive('Seleccioná una periodicidad.'),
  formaPagoId: z.number().int().positive('Seleccioná una forma de pago.'),
  formaDesembolsoId: z.number().int().positive('Seleccioná una forma de desembolso.'),
  cantidadPagos: z.number().int().positive('Ingresá una cantidad positiva.'),
  observaciones: z.string().max(1000, 'Máximo 1000 caracteres.'),
})

type Values = z.infer<typeof schema>
const clienteRepository = new AxiosClienteRepository()
const prestamoRepository = new AxiosPrestamoRepository()

function nombreCliente(cliente: Cliente) {
  return [cliente.primerNombre, cliente.segundoNombre, cliente.primerApellido, cliente.segundoApellido].filter(Boolean).join(' ')
}

const displayValue = (value: string | null) => value || '—'

type PaymentRow = { numero: number; fecha: string; monto: number }
type PlanType = 'automatico' | 'personalizado'
type FinancialSnapshot = Pick<Values, 'fechaAlta' | 'capital' | 'interes' | 'periodicidadPagoId' | 'cantidadPagos'>

const formatCRC = (value: number) => new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 2 }).format(value)
const dateParts = (value: string) => value.split('-').map(Number)
const logicalDate = (value: string) => {
  const [year, month, day] = dateParts(value)
  return new Date(Date.UTC(year, month - 1, day))
}
const dateText = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
const moveSundayToMonday = (value: string) => logicalDate(value).getUTCDay() === 0 ? addDays(value, 1) : value
const readableDate = (value: string) => {
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : value || '—'
}
const addDays = (value: string, days: number) => { const date = logicalDate(value); date.setUTCDate(date.getUTCDate() + days); return dateText(date) }
const addMonthClamped = (value: string) => {
  const date = logicalDate(value)
  const sourceLastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  const targetLastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 2, 0)).getUTCDate()
  const day = date.getUTCDate() === sourceLastDay ? targetLastDay : Math.min(date.getUTCDate(), targetLastDay)
  return dateText(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, day)))
}
const nextDate = (value: string, periodicidad: string) => moveSundayToMonday(periodicidad === 'DIARIO' ? addDays(value, 1) : periodicidad === 'SEMANAL' ? addDays(value, 7) : periodicidad === 'QUINCENAL' ? addDays(value, 15) : addMonthClamped(value))
const sameFinancialData = (a: FinancialSnapshot | null, b: FinancialSnapshot) => !!a && ['fechaAlta', 'capital', 'interes', 'periodicidadPagoId', 'cantidadPagos'].every((key) => a[key as keyof FinancialSnapshot] === b[key as keyof FinancialSnapshot])

function generatePlan(values: FinancialSnapshot, periodicidades: Periodicidad[]): PaymentRow[] {
  const periodicidad = periodicidades.find((item) => item.id === values.periodicidadPagoId)?.nombre.trim().toUpperCase()
  if (!periodicidad || !['DIARIO', 'SEMANAL', 'QUINCENAL', 'MENSUAL'].includes(periodicidad) || !Number.isInteger(values.cantidadPagos) || values.cantidadPagos <= 0) return []
  const totalCents = Math.round((values.capital + values.interes) * 100)
  const baseCents = Math.floor(totalCents / values.cantidadPagos)
  const rows: PaymentRow[] = []
  let date = values.fechaAlta
  for (let index = 1; index <= values.cantidadPagos; index += 1) {
    date = nextDate(date, periodicidad)
    rows.push({ numero: index, fecha: date, monto: (index === values.cantidadPagos ? totalCents - baseCents * (values.cantidadPagos - 1) : baseCents) / 100 })
  }
  return rows
}

function ClienteSelector({ selectedClient, onSelectClient }: { selectedClient: Cliente | null; onSelectClient: (cliente: Cliente) => void }) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState<ClientePage | null>(null)
  const [identificacion, setIdentificacion] = useState('')
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const limite = 10

  const load = useCallback(async () => {
    setLoading(true)
    const filters: ClienteFilters = { pagina, limite, activo: true }
    // The API exposes one general `buscar` term for identification, name and phone.
    const buscar = identificacion.trim() || nombre.trim() || telefono.trim()
    if (buscar) filters.buscar = buscar
    if (direccion.trim()) filters.direccion = direccion.trim()
    try {
      setPage(await listarClientes(clienteRepository, filters))
      setError('')
    } catch (cause) {
      setError(clienteErrorMessage(cause))
    } finally {
      setLoading(false)
    }
  }, [direccion, identificacion, nombre, pagina, telefono])

  useEffect(() => {
    if (open) void load()
  }, [load, open])

  const changeFilter = (setter: (value: string) => void, value: string) => {
    setter(value)
    setPagina(1)
  }
  const clearFilters = () => {
    setIdentificacion('')
    setNombre('')
    setTelefono('')
    setDireccion('')
    setPagina(1)
  }
  const select = (cliente: Cliente) => {
    onSelectClient(cliente)
    setOpen(false)
  }

  return <>
    <div className="prestamo-client-selector">
      {!selectedClient ? <button type="button" className="secondary-button prestamo-client-search" onClick={() => setOpen(true)}><Search size={16} /> Buscar cliente</button> : <>
        <div className="prestamo-selected-client">
          <strong>{nombreCliente(selectedClient)}</strong>
          <span><b>Identificación:</b> {selectedClient.identificacion}</span>
          <span><b>Teléfono:</b> {displayValue(selectedClient.telefono1)}</span>
          <span><b>Dirección:</b> {displayValue(selectedClient.direccion)}</span>
        </div>
        <button type="button" className="secondary-button" onClick={() => setOpen(true)}>Cambiar cliente</button>
      </>}
    </div>
    {open && <div className="cliente-selector-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
      <div className="cliente-selector-modal" role="dialog" aria-modal="true" aria-labelledby="cliente-selector-title">
        <div className="cliente-selector-header"><h2 id="cliente-selector-title">Seleccionar cliente</h2><button type="button" className="table-action" onClick={() => setOpen(false)} aria-label="Cerrar selector de cliente"><X size={19} /></button></div>
        <div className="cliente-selector-filters">
          <label>Identificación<input value={identificacion} onChange={(event) => changeFilter(setIdentificacion, event.target.value)} /></label>
          <label>Nombre<input value={nombre} onChange={(event) => changeFilter(setNombre, event.target.value)} /></label>
          <label>Teléfono<input value={telefono} onChange={(event) => changeFilter(setTelefono, event.target.value)} /></label>
          <label>Dirección<input value={direccion} onChange={(event) => changeFilter(setDireccion, event.target.value)} /></label>
          <div className="cliente-selector-filter-actions"><button type="button" className="primary-button" onClick={() => void load()}>Buscar</button><button type="button" className="secondary-button" onClick={clearFilters}>Limpiar</button></div>
        </div>
        <p className="form-note">Identificación, nombre y teléfono utilizan la búsqueda general disponible; se aplica el primer campo informado. Dirección usa su filtro independiente.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {loading ? <div className="state-box">Cargando clientes...</div> : <div className="table-wrap cliente-selector-table-wrap"><table className="cliente-selector-table"><thead><tr><th>Identificación</th><th>Nombre</th><th>Teléfono</th><th>Dirección</th><th>Acción</th></tr></thead><tbody>{page?.datos.map((cliente) => <tr key={cliente.id}><td>{cliente.identificacion}</td><td>{nombreCliente(cliente)}</td><td>{cliente.telefono1}</td><td className="cliente-selector-address" title={cliente.direccion ?? undefined}>{displayValue(cliente.direccion)}</td><td><button type="button" className="primary-button" onClick={() => select(cliente)}>Seleccionar</button></td></tr>)}</tbody></table>{!page?.datos.length && <p className="form-note">No hay clientes para mostrar.</p>}</div>}
        {page && <div className="cliente-selector-pagination"><button type="button" className="table-action" disabled={pagina <= 1} onClick={() => setPagina((value) => value - 1)}><ChevronLeft size={16} /></button><span>Página {pagina} de {Math.max(page.totalPaginas, 1)} · {page.total} clientes</span><button type="button" className="table-action" disabled={pagina >= page.totalPaginas} onClick={() => setPagina((value) => value + 1)}><ChevronRight size={16} /></button></div>}
      </div>
    </div>}
  </>
}

const defaults: Values = {
  clienteId: 0, fechaAlta: (() => { const today = new Date(); return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}` })(), capital: 0, interes: 0,
  periodicidadPagoId: 0, formaPagoId: 0, formaDesembolsoId: 0, cantidadPagos: 1, observaciones: '',
}

export function PrestamoForm({
  formasPago, periodicidades, initialSelectedClient, onCancel,
}: { formasPago: FormaPago[]; periodicidades: Periodicidad[]; initialSelectedClient?: Cliente; onCancel: () => void }) {
  const [selectedClient, setSelectedClient] = useState<Cliente | null>(() => initialSelectedClient ?? null)
  const [stage, setStage] = useState<1 | 2 | 3>(1)
  const [planType, setPlanType] = useState<PlanType>('automatico')
  const [plan, setPlan] = useState<PaymentRow[]>([])
  const [financialSnapshot, setFinancialSnapshot] = useState<FinancialSnapshot | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')
  const savingRef = useRef(false)
  const navigate = useNavigate()
  const { register, control, handleSubmit, setValue, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { ...defaults, clienteId: initialSelectedClient?.id ?? defaults.clienteId },
  })
  const values = useWatch({ control })
  const field = (name: keyof Values) => errors[name] && <small className="field-error">{errors[name]?.message as string}</small>
  const handleSelectClient = (cliente: Cliente) => {
    setValue('clienteId', cliente.id, { shouldValidate: true })
    setSelectedClient(cliente)
  }

  const financialData = (current: Values): FinancialSnapshot => ({ fechaAlta: current.fechaAlta, capital: current.capital, interes: current.interes, periodicidadPagoId: current.periodicidadPagoId, cantidadPagos: current.cantidadPagos })
  const totalCents = Math.round(((values.capital ?? 0) + (values.interes ?? 0)) * 100)
  const distributedCents = plan.reduce((sum, row) => sum + Math.round(row.monto * 100), 0)
  const hasSunday = planType === 'personalizado' && plan.some((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.fecha) && dateText(logicalDate(row.fecha)) === row.fecha && logicalDate(row.fecha).getUTCDay() === 0)
  const planValid = !hasSunday && plan.length === (values.cantidadPagos ?? 0) && plan.every((row, index) => row.numero === index + 1 && /^\d{4}-\d{2}-\d{2}$/.test(row.fecha) && Number.isFinite(logicalDate(row.fecha).getTime()) && dateText(logicalDate(row.fecha)) === row.fecha && row.fecha > (index === 0 ? (values.fechaAlta ?? '') : plan[index - 1].fecha) && Number.isFinite(row.monto) && row.monto > 0) && distributedCents === totalCents
  const updateRow = (index: number, change: Partial<PaymentRow>) => setPlan((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...change } : row))
  const enterPayments = (current: Values) => {
    const data = financialData(current)
    if (!sameFinancialData(financialSnapshot, data)) {
      setPlanType('automatico')
      setPlan(generatePlan(data, periodicidades))
    }
    setFinancialSnapshot(data)
    setStage(2)
  }
  const setAutomatic = () => {
    setPlanType('automatico')
    setPlan(generatePlan(financialData(values as Values), periodicidades))
  }
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (stage === 3) {
      event.preventDefault()
      void handleSubmit(save)(event)
      return
    }
    void handleSubmit(enterPayments)(event)
  }
  const save = async (current: Values) => {
    if (savingRef.current || saved) return
    if (!selectedClient || current.clienteId !== selectedClient.id) {
      setSaveError('Seleccioná un cliente antes de guardar el préstamo.')
      return
    }
    if (!planValid) {
      setSaveError('Revisá el plan de pagos antes de guardar el préstamo.')
      return
    }

    const input: PrestamoInput = {
      clienteId: selectedClient.id,
      periodicidadPagoId: current.periodicidadPagoId,
      formaPagoId: current.formaPagoId,
      formaDesembolsoId: current.formaDesembolsoId,
      fechaAlta: current.fechaAlta,
      capital: current.capital,
      interes: current.interes,
      cantidadPagos: current.cantidadPagos,
      planPersonalizado: planType === 'personalizado',
      ...(current.observaciones.trim() ? { observaciones: current.observaciones.trim() } : {}),
      ...(planType === 'personalizado' ? {
        cuotas: plan.map((row) => ({
          numeroPago: row.numero,
          fechaVencimiento: row.fecha,
          montoProgramado: row.monto,
        })),
      } : {}),
    }

    savingRef.current = true
    setSaving(true)
    setSaveError('')
    setSaveSuccess('')
    try {
      const prestamo = await crearPrestamo(prestamoRepository, input)
      setSaved(true)
      try {
        await abrirPlanPagoPdf(prestamoRepository, prestamo.id)
        setSaveSuccess('Préstamo guardado correctamente. El plan de pago se abrió en otra pestaña. Redirigiendo a Préstamos...')
      } catch (cause) {
        setSaveError(`El préstamo se guardó correctamente, pero no se pudo abrir el PDF: ${prestamoErrorMessage(cause)}`)
        setSaveSuccess('Continuando a Préstamos...')
      }
      window.setTimeout(() => navigate('/prestamos'), 900)
    } catch (cause) {
      setSaveError(prestamoErrorMessage(cause))
      if (cause instanceof PrestamoError && cause.message && cause.status === 422) setSaveError(cause.message)
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }
  const periodicidadNombre = periodicidades.find((item) => item.id === values.periodicidadPagoId)?.nombre ?? '—'
  const formaPagoNombre = formasPago.find((item) => item.id === values.formaPagoId)?.nombre ?? '—'
  const formaDesembolsoNombre = formasPago.find((item) => item.id === values.formaDesembolsoId)?.nombre ?? '—'
  const tasaInformativa = (values.capital ?? 0) > 0 ? ((values.interes ?? 0) / (values.capital ?? 0)) * 100 : 0
  return <form className="prestamo-form" onSubmit={onSubmit} noValidate>
     <div className="prestamo-stages" aria-label="Etapas del nuevo préstamo">
        <div className={`prestamo-stage ${stage === 1 ? 'active' : ''} ${stage > 1 ? 'completed' : ''}`}><strong>1</strong><span>Datos del préstamo</span></div>
        <div className={`prestamo-stage ${stage === 2 ? 'active' : ''} ${stage > 2 ? 'completed' : ''}`}><strong>2</strong><span>Plan de pagos</span></div>
        <div className={`prestamo-stage ${stage === 3 ? 'active' : ''}`}><strong>3</strong><span>Confirmación</span></div>
      </div>
     {stage === 2 ? <>
       <div className="prestamo-payment-summary">
         <span>Capital<strong>{formatCRC(values.capital ?? 0)}</strong></span><span>Interés acordado<strong>{formatCRC(values.interes ?? 0)}</strong></span><span>Total a pagar<strong>{formatCRC(totalCents / 100)}</strong></span><span>Tasa informativa<strong>{`${((values.capital ?? 0) > 0 ? ((values.interes ?? 0) / (values.capital ?? 0)) * 100 : 0).toFixed(2)}%`}</strong></span><span>Periodicidad<strong>{periodicidades.find((item) => item.id === values.periodicidadPagoId)?.nombre ?? '—'}</strong></span><span>Cantidad de pagos<strong>{values.cantidadPagos ?? 0}</strong></span>
       </div>
       <div className="prestamo-plan-controls" role="group" aria-label="Tipo de plan de pagos"><span>Plan</span><button type="button" className={planType === 'automatico' ? 'selected' : ''} onClick={setAutomatic}>Automático</button><button type="button" className={planType === 'personalizado' ? 'selected' : ''} onClick={() => setPlanType('personalizado')}>Personalizado</button></div>
       <div className="table-wrap prestamo-payment-table-wrap"><table className="prestamo-payment-table"><thead><tr><th>N°</th><th>Fecha</th><th>Monto</th></tr></thead><tbody>{plan.map((row, index) => <tr key={row.numero}><td>{row.numero}</td><td>{planType === 'personalizado' ? <input type="date" value={row.fecha} onChange={(event) => updateRow(index, { fecha: event.target.value })} /> : row.fecha}</td><td>{planType === 'personalizado' ? <CurrencyInput value={row.monto} onChange={(value) => updateRow(index, { monto: value ?? 0 })} inputMode="decimal" aria-label={`Monto de cuota ${row.numero}`} /> : formatCRC(row.monto)}</td></tr>)}</tbody></table></div>
       <div className="prestamo-payment-totals"><span>Total a pagar <strong>{formatCRC(totalCents / 100)}</strong></span><span>Total distribuido <strong>{formatCRC(distributedCents / 100)}</strong></span><span>Diferencia <strong>{formatCRC((totalCents - distributedCents) / 100)}</strong></span></div>
       {planType === 'personalizado' && distributedCents !== totalCents && <p className="form-error" role="alert">El total de las cuotas debe ser igual al total a pagar.</p>}
        {planType === 'personalizado' && hasSunday && <p className="form-error" role="alert">No se permiten cuotas en domingo.</p>}
        {planType === 'personalizado' && !hasSunday && !planValid && distributedCents === totalCents && <p className="form-error" role="alert">Revisá la cantidad, las fechas y los montos de las cuotas.</p>}
       <div className="prestamo-form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancelar</button><button type="button" className="secondary-button" onClick={() => setStage(1)}>Volver</button><button type="button" className="primary-button" disabled={!planValid} onClick={() => setStage(3)}>Continuar</button></div>
      </> : stage === 3 ? <section className="prestamo-confirmation" aria-labelledby="prestamo-confirmation-title">
        <div className="prestamo-confirmation-header"><h2 id="prestamo-confirmation-title">Confirmación</h2><span className={`prestamo-plan-badge ${planType}`}>{planType === 'automatico' ? 'Automático' : 'Personalizado'}</span></div>
         <div className="prestamo-confirmation-section"><h3>Cliente</h3><div className="prestamo-confirmation-grid"><div><span>Nombre completo</span><strong>{selectedClient ? nombreCliente(selectedClient) : '—'}</strong></div><div><span>Identificación</span><strong>{selectedClient?.identificacion ?? '—'}</strong></div><div><span>Teléfono</span><strong>{selectedClient?.telefono1 ?? '—'}</strong></div><div className="prestamo-confirmation-wide"><span>Dirección</span><strong>{displayValue(selectedClient?.direccion ?? null)}</strong></div></div></div>
          <div className="prestamo-confirmation-section"><h3>Datos del préstamo</h3><div className="prestamo-confirmation-grid"><div><span>Fecha de alta</span><strong>{readableDate(values.fechaAlta ?? '')}</strong></div><div><span>Capital</span><strong>{formatCRC(values.capital ?? 0)}</strong></div><div><span>Interés acordado</span><strong>{formatCRC(values.interes ?? 0)}</strong></div><div><span>Total a pagar</span><strong>{formatCRC(totalCents / 100)}</strong></div><div><span>Tasa informativa</span><strong>{`${tasaInformativa.toFixed(2)}%`}</strong></div><div><span>Periodicidad</span><strong>{periodicidadNombre}</strong></div><div><span>Forma de pago</span><strong>{formaPagoNombre}</strong></div><div><span>Forma de desembolso</span><strong>{formaDesembolsoNombre}</strong></div><div><span>Cantidad de pagos</span><strong>{values.cantidadPagos ?? 0}</strong></div><div><span>Tipo de plan</span><strong>{planType === 'automatico' ? 'Automático' : 'Personalizado'}</strong></div><div className="prestamo-confirmation-wide"><span>Observaciones</span><strong>{values.observaciones || '-'}</strong></div></div></div>
        <div className="prestamo-confirmation-section"><div className="prestamo-confirmation-title-row"><h3>Plan de pagos</h3><span>Tipo: {planType === 'automatico' ? 'Automático' : 'Personalizado'}</span></div><div className="table-wrap prestamo-payment-table-wrap"><table className="prestamo-payment-table"><thead><tr><th>N°</th><th>Fecha</th><th>Monto</th></tr></thead><tbody>{plan.map((row) => <tr key={row.numero}><td>{row.numero}</td><td>{row.fecha}</td><td>{formatCRC(row.monto)}</td></tr>)}</tbody></table></div><div className="prestamo-payment-totals"><span>Total a pagar <strong>{formatCRC(totalCents / 100)}</strong></span><span>Total distribuido <strong>{formatCRC(distributedCents / 100)}</strong></span><span>Diferencia <strong>{formatCRC((totalCents - distributedCents) / 100)}</strong></span></div>{totalCents !== distributedCents && <p className="form-error" role="alert">La diferencia entre el total a pagar y el total distribuido debe ser cero antes de guardar el préstamo.</p>}</div>
         {saveError && <p className="form-error" role="alert">{saveError}</p>}
         {saveSuccess && <p className="form-success" role="status">{saveSuccess}</p>}
          <div className="prestamo-form-actions"><button type="button" className="secondary-button" onClick={onCancel} disabled={saving || saved}>Cancelar</button><button type="button" className="secondary-button" onClick={() => setStage(2)} disabled={saving || saved}>Volver</button><button type="submit" className="primary-button" disabled={!planValid || saving || saved} aria-disabled={!planValid || saving || saved}>{saving ? 'Guardando...' : 'Guardar préstamo'}</button></div>
      </section> : <>
    <div className="prestamo-form-grid">
      <div className="prestamo-client-field prestamo-wide"><span>Cliente</span><ClienteSelector selectedClient={selectedClient} onSelectClient={handleSelectClient} /><input type="hidden" {...register('clienteId', { valueAsNumber: true })} value={selectedClient?.id ?? 0} />{field('clienteId')}</div>
      <label>Fecha de alta<input type="date" {...register('fechaAlta')} />{field('fechaAlta')}</label>
       <label>Forma de pago<select {...register('formaPagoId', { setValueAs: (value) => Number(value) })}><option value="0">Seleccioná una forma de pago</option>{formasPago.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>{field('formaPagoId')}</label>
       <label>Forma de desembolso<select {...register('formaDesembolsoId', { setValueAs: (value) => Number(value) })}><option value="0">Seleccioná una forma de desembolso</option>{formasPago.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>{field('formaDesembolsoId')}</label>
      <label>Capital<Controller name="capital" control={control} render={({ field: input }) => <CurrencyInput {...input} value={input.value} onChange={input.onChange} inputMode="decimal" aria-invalid={!!errors.capital} />} />{field('capital')}</label>
      <label>Monto interés<Controller name="interes" control={control} render={({ field: input }) => <CurrencyInput {...input} value={input.value} onChange={input.onChange} inputMode="decimal" aria-invalid={!!errors.interes} />} />{field('interes')}</label>
      <label>Periodicidad<select {...register('periodicidadPagoId', { setValueAs: (value) => Number(value) })}><option value="0">Seleccioná una periodicidad</option>{periodicidades.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>{field('periodicidadPagoId')}</label>
      <label>Cantidad de pagos<input type="number" min="1" step="1" {...register('cantidadPagos', { setValueAs: (value) => Number(value) })} />{field('cantidadPagos')}</label>
        <label className="prestamo-wide">Observaciones<textarea rows={3} maxLength={1000} {...register('observaciones')} />{field('observaciones')}</label>
    </div>
    <div className="prestamo-form-actions">
      <button type="button" className="secondary-button" onClick={onCancel}>Cancelar</button>
       <button type="submit" className="primary-button">Continuar</button>
     </div>
    </>}
   </form>
 }
