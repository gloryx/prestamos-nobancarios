import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { Cliente } from '@/features/clientes/domain/cliente.types'
import { listFormasPago } from '@/features/formas-pago/application/formas-pago.use-cases'
import type { FormaPago } from '@/features/formas-pago/domain/forma-pago.types'
import { AxiosFormaPagoRepository } from '@/features/formas-pago/infrastructure/axios-forma-pago.repository'
import { listPeriodicidades } from '@/features/periodicidades-pago/application/periodicidades-pago.use-cases'
import type { Periodicidad } from '@/features/periodicidades-pago/domain/periodicidad-pago.types'
import { AxiosPeriodicidadRepository } from '@/features/periodicidades-pago/infrastructure/axios-periodicidad.repository'
import { actualizarPrestamo, listarPlanPago, obtenerPrestamo } from '../application/prestamos.use-cases'
import { obtenerResumenDelPrestamo } from '../application/pagos.use-cases'
import { PrestamoError, prestamoErrorMessage } from '../domain/prestamo.error'
import type { PagoResumen } from '../domain/pago.types'
import type { PlanPago, Prestamo } from '../domain/prestamo.types'
import { AxiosPrestamoRepository } from '../infrastructure/axios-prestamo.repository'
import { AxiosPagoRepository } from '../infrastructure/axios-pago.repository'
import { PrestamoForm } from './PrestamoForm'

const formaPagoRepository = new AxiosFormaPagoRepository()
const periodicidadRepository = new AxiosPeriodicidadRepository()
const prestamoRepository = new AxiosPrestamoRepository()
const pagoRepository = new AxiosPagoRepository()
type PrestamosLocationState = { selectedClient?: Cliente }

export function PrestamosPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id: idParam } = useParams<{ id: string }>()
  const editId = idParam ? Number(idParam) : undefined
  const editMode = idParam !== undefined && Number.isInteger(editId) && editId !== undefined && editId > 0
  const invalidEditId = idParam !== undefined && !editMode
  const selectedClient = (location.state as PrestamosLocationState | null)?.selectedClient
  const [formasPago, setFormasPago] = useState<FormaPago[]>([])
  const [periodicidades, setPeriodicidades] = useState<Periodicidad[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [prestamo, setPrestamo] = useState<Prestamo | undefined>()
  const [plan, setPlan] = useState<PlanPago[]>([])
  const [summary, setSummary] = useState<PagoResumen | undefined>()

  const updateLoan = async (input: Parameters<typeof actualizarPrestamo>[2]): Promise<Prestamo> => {
    const updatedLoan = await actualizarPrestamo(prestamoRepository, editId!, input)
    setPrestamo(updatedLoan)

    try {
      const [refreshedLoan, refreshedPlan, refreshedSummary] = await Promise.all([
        obtenerPrestamo(prestamoRepository, editId!),
        listarPlanPago(prestamoRepository, editId!),
        obtenerResumenDelPrestamo(pagoRepository, editId!),
      ])
      setPrestamo(refreshedLoan)
      setPlan(refreshedPlan)
      setSummary(refreshedSummary)
      setError('')
      return refreshedLoan
    } catch {
      const refreshMessage = 'El préstamo se actualizó correctamente, pero no se pudo refrescar el plan y el resumen. Verificá la información y recargá la página.'
      setError(refreshMessage)
      throw new PrestamoError(0, refreshMessage)
    }
  }

  useEffect(() => {
    let cancelled = false
    if (invalidEditId) {
      setLoading(false)
      setError('El identificador del préstamo no es válido.')
      return () => { cancelled = true }
    }
    const loanPromise = editMode ? obtenerPrestamo(prestamoRepository, editId!) : Promise.resolve(undefined)
    const planPromise = editMode ? listarPlanPago(prestamoRepository, editId!) : Promise.resolve([] as PlanPago[])
    const summaryPromise = editMode ? obtenerResumenDelPrestamo(pagoRepository, editId!) : Promise.resolve(undefined)
    void Promise.all([
      listFormasPago(formaPagoRepository),
      listPeriodicidades(periodicidadRepository),
      loanPromise,
      planPromise,
      summaryPromise,
    ]).then(([formas, periods, loan, nextPlan, nextSummary]) => {
      if (cancelled) return
      setPrestamo(loan)
      setPlan(nextPlan)
      setSummary(nextSummary)
      const formasActivas = formas.filter((forma) => forma.activo)
      const periodicidadesActivas = periods.filter((periodicidad) => periodicidad.activo)
      const formasHistoricas = [loan?.formaDesembolso, loan?.formaPago]
        .filter((forma): forma is NonNullable<typeof forma> => Boolean(forma))
        .filter((forma, index, all) => all.findIndex((item) => item.id === forma.id) === index)
        .filter((forma) => !formasActivas.some((active) => active.id === forma.id))
        .map((forma) => ({ id: forma.id, nombre: forma.nombre, activo: false }))
      const periodicidadesHistoricas = loan?.periodicidadPago && !periodicidadesActivas.some((item) => item.id === loan.periodicidadPagoId)
        ? [{ id: loan.periodicidadPago.id, nombre: loan.periodicidadPago.nombre, activo: false }]
        : []
      setFormasPago([...formasActivas, ...formasHistoricas])
      setPeriodicidades([...periodicidadesActivas, ...periodicidadesHistoricas])
      setError('')
    }).catch((cause: unknown) => {
      if (!cancelled) setError(editMode ? prestamoErrorMessage(cause) : 'No se pudieron cargar los clientes y catálogos. Intentá nuevamente.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [editId, editMode, invalidEditId])

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PRÉSTAMOS</p>
          <h1>{editMode ? `Editar préstamo #${editId}` : 'Nuevo préstamo'}</h1>
          <p className="muted">{editMode ? 'Actualice las condiciones vigentes del préstamo.' : 'Registrá la información inicial del préstamo.'}</p>
        </div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading ? <div className="panel state-box">{editMode ? 'Cargando préstamo y plan operativo...' : 'Cargando clientes y catálogos...'}</div> : invalidEditId ? (
        <div className="panel state-box" role="alert">{error}</div>
      ) : editMode && !prestamo ? (
        <div className="panel state-box" role="alert">{error || 'No se pudo cargar el préstamo.'}</div>
      ) : prestamo?.estado === 'CANCELADO' || prestamo?.estado === 'ANULADO' ? (
        <div className="panel state-box" role="alert">Un préstamo cancelado o anulado no puede modificarse.</div>
      ) : (
        <div className="panel prestamo-panel">
          <PrestamoForm
            formasPago={formasPago}
            periodicidades={periodicidades}
            initialSelectedClient={editMode && prestamo ? {
              id: prestamo.cliente.id,
              identificacion: prestamo.cliente.identificacion,
              primerNombre: prestamo.cliente.nombreCompleto,
              segundoNombre: null,
              primerApellido: '',
              segundoApellido: null,
              genero: null,
              fechaNacimiento: null,
              direccion: prestamo.cliente.direccion ?? null,
              correo: null,
              telefono1: '',
              telefono2: null,
              nacionalidad: null,
              observaciones: null,
              urlIdentificacion: null,
              activo: true,
              fechaIngreso: prestamo.fechaAlta,
            } : selectedClient}
            mode={editMode ? 'edit' : 'create'}
            initialLoan={prestamo}
            initialPlan={plan}
            initialSummary={summary}
            onUpdate={editMode ? updateLoan : undefined}
            onCancel={() => navigate('/prestamos')}
          />
        </div>
      )}
    </section>
  )
}
