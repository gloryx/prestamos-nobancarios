import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Cliente } from '@/features/clientes/domain/cliente.types'
import { listFormasPago } from '@/features/formas-pago/application/formas-pago.use-cases'
import type { FormaPago } from '@/features/formas-pago/domain/forma-pago.types'
import { AxiosFormaPagoRepository } from '@/features/formas-pago/infrastructure/axios-forma-pago.repository'
import { listPeriodicidades } from '@/features/periodicidades-pago/application/periodicidades-pago.use-cases'
import type { Periodicidad } from '@/features/periodicidades-pago/domain/periodicidad-pago.types'
import { AxiosPeriodicidadRepository } from '@/features/periodicidades-pago/infrastructure/axios-periodicidad.repository'
import { PrestamoForm } from './PrestamoForm'

const formaPagoRepository = new AxiosFormaPagoRepository()
const periodicidadRepository = new AxiosPeriodicidadRepository()
type PrestamosLocationState = { selectedClient?: Cliente }

export function PrestamosPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const selectedClient = (location.state as PrestamosLocationState | null)?.selectedClient
  const [formasPago, setFormasPago] = useState<FormaPago[]>([])
  const [periodicidades, setPeriodicidades] = useState<Periodicidad[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      listFormasPago(formaPagoRepository),
      listPeriodicidades(periodicidadRepository),
    ]).then(([formas, periods]) => {
      if (cancelled) return
      setFormasPago(formas.filter((forma) => forma.activo))
      setPeriodicidades(periods.filter((periodicidad) => periodicidad.activo))
      setError('')
    }).catch(() => {
      if (!cancelled) setError('No se pudieron cargar los clientes y catálogos. Intentá nuevamente.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PRÉSTAMOS</p>
          <h1>Nuevo préstamo</h1>
          <p className="muted">Registrá la información inicial del préstamo.</p>
        </div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading ? <div className="panel state-box">Cargando clientes y catálogos...</div> : (
        <div className="panel prestamo-panel">
          <PrestamoForm
            formasPago={formasPago}
            periodicidades={periodicidades}
            initialSelectedClient={selectedClient}
            onCancel={() => navigate('/prestamos')}
          />
        </div>
      )}
    </section>
  )
}
