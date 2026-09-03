import { useCallback, useEffect, useState } from 'react'
import { ApiConfiguracionFinancieraRepository } from '../infrastructure/axios-configuracion-financiera.repository'
import { crearConfiguracionFinanciera, obtenerConfiguracionFinanciera } from '../application/configuracion-financiera.use-cases'
import { configuracionFinancieraErrorMessage } from '../domain/configuracion-financiera.error'
import type { ConfiguracionFinanciera } from '../domain/configuracion-financiera.types'
import { ConfiguracionFinancieraForm } from './ConfiguracionFinancieraForm'
import { formatCRC } from '../../../shared/utils/currency'

const repository = new ApiConfiguracionFinancieraRepository()

export function ConfiguracionFinancieraPage() {
  const [configuracion, setConfiguracion] = useState<ConfiguracionFinanciera | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setConfiguracion(await obtenerConfiguracionFinanciera(repository))
      setError('')
    } catch (cause) {
      setError(configuracionFinancieraErrorMessage(cause))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const save = async (input: Parameters<typeof crearConfiguracionFinanciera>[1]) => {
    if (!window.confirm('Esta operación establecerá el punto inicial del control financiero. Verifique los datos antes de continuar.')) return
    setLoading(true)
    try {
      await crearConfiguracionFinanciera(repository, input)
      await load()
    } catch (cause) {
      setError(configuracionFinancieraErrorMessage(cause))
      if (configuracionFinancieraErrorMessage(cause) === 'La apertura financiera ya fue realizada.') await load()
    }
  }

  return <section>
    <div className="page-heading"><div><p className="eyebrow">CONFIGURACIÓN</p><h1>Configuración financiera</h1><p className="muted">Define el punto de partida para el control financiero del negocio.</p></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <div className="panel state-box">Cargando configuración financiera...</div> : configuracion ? <OpeningSummary config={configuracion} /> : <ConfiguracionFinancieraForm onSubmit={save} />}
  </section>
}

function OpeningSummary({ config }: { config: ConfiguracionFinanciera }) {
  return <div className="financial-summary">
    <div className="financial-summary-header"><div><p className="eyebrow">APERTURA FINANCIERA</p><h2>Apertura realizada</h2></div><span className="status-badge active">Apertura realizada</span></div>
     <div className="financial-summary-grid"><SummaryItem label="Fecha de apertura" value={config.fechaApertura} /><SummaryItem label="Cartera inicial" value={formatCRC(config.carteraInicial)} /><SummaryItem label="Cartera activa inicial" value={formatCRC(config.carteraActivaInicial)} /><SummaryItem label="Cartera incobrable inicial" value={formatCRC(config.carteraIncobrableInicial)} /><SummaryItem label="Disponible inicial" value={formatCRC(config.disponibleInicial)} /><SummaryItem label="Capital semilla histórico" value={config.capitalSemillaHistorico === null ? '—' : formatCRC(config.capitalSemillaHistorico)} /></div>
     <div className="financial-observations"><strong>Observaciones</strong><p>{config.observaciones ?? 'Sin observaciones registradas.'}</p></div>
  </div>
}

function SummaryItem({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div> }
