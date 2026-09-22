import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarDays, Eye, LoaderCircle, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatCRC } from '@/shared/utils/currency'
import { formatDateOnly, todayInCostaRica } from '@/shared/utils/date'
import { confirmAction } from '@/shared/utils/sweet-alert'
import { confirmClosing, getClosingSnapshot, listClosingSnapshots, previewClosing } from '../application/cierres-mensuales.use-cases'
import { cierreMensualError, cierreMensualStatus } from '../domain/cierre-mensual.error'
import type { ClosingPreview, ClosingSnapshot } from '../domain/cierre-mensual.types'
import { AxiosCierreMensualRepository } from '../infrastructure/axios-cierre-mensual.repository'
import { CierreMensualFinancialView } from './CierreMensualFinancialView'
import './cierres-mensuales.css'

const repository = new AxiosCierreMensualRepository()
const today = todayInCostaRica()
const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export function CierresMensualesPage() {
  const [year, setYear] = useState(Number(today.slice(0, 4))); const [month, setMonth] = useState(Number(today.slice(5, 7)))
  const [preview, setPreview] = useState<ClosingPreview | null>(null); const [history, setHistory] = useState<ClosingSnapshot[]>([])
  const [selected, setSelected] = useState<ClosingSnapshot | null>(null); const [loadingPreview, setLoadingPreview] = useState(true); const [loadingHistory, setLoadingHistory] = useState(true)
  const [error, setError] = useState(''); const [previewStatus, setPreviewStatus] = useState<number | undefined>(); const [observations, setObservations] = useState(''); const [confirming, setConfirming] = useState(false); const requestSequence = useRef(0); const historyRequestSequence = useRef(0); const isMounted = useRef(false)

  const loadHistory = useCallback(async () => { if (!isMounted.current) return; const request = ++historyRequestSequence.current; const isCurrentRequest = () => isMounted.current && request === historyRequestSequence.current; setLoadingHistory(true); try { const result = await listClosingSnapshots(repository); if (isCurrentRequest()) { setHistory(result); setError('') } } catch (reason) { if (isCurrentRequest()) setError(cierreMensualError(reason)) } finally { if (isCurrentRequest()) setLoadingHistory(false) } }, [])
  const loadPreview = useCallback(async () => { const request = ++requestSequence.current; setLoadingPreview(true); setError(''); setPreviewStatus(undefined); try { const result = await previewClosing(repository, year, month); if (request === requestSequence.current) setPreview(result) } catch (reason) { if (request === requestSequence.current) { setPreview(null); setPreviewStatus(cierreMensualStatus(reason)); setError(cierreMensualError(reason)) } } finally { if (request === requestSequence.current) setLoadingPreview(false) } }, [month, year])
  useEffect(() => { isMounted.current = true; return () => { isMounted.current = false } }, [])
  useEffect(() => { void loadPreview() }, [loadPreview]); useEffect(() => { void loadHistory() }, [loadHistory])

  const confirm = async () => {
    if (!preview?.puedeConfirmar || !preview.canClose || preview.estadoDocumental !== 'LISTO_PARA_CONFIRMAR') return
    if (confirming) return
    setConfirming(true)
    const trimmed = observations.trim(); let snapshot: ClosingSnapshot | null = null
    try {
      const confirmed = await confirmAction({
        title: `Confirmar cierre de ${monthNames[month - 1]} ${year}`,
        text: `Período: ${monthNames[month - 1]} ${year}\nFecha de inicio: ${formatDateOnly(preview.fechaInicio)}\nFecha de fin: ${formatDateOnly(preview.fechaFin)}\nDisponible final: ${formatCRC(preview.disponibleFinal)}\nCartera total final: ${formatCRC(preview.carteraTotal)}\nResultado del mes: ${formatCRC(preview.detalles.find(detail => detail.concepto === 'RESULTADO_MES')?.monto ?? 0)}\n\nSe conservará un snapshot histórico inmutable. El backend volverá a calcular y validar la información antes de confirmar. Las operaciones económicas del período cerrado quedarán sujetas a las restricciones de períodos cerrados. Un período cerrado no puede volver a confirmarse ni modificarse desde este flujo.`,
        confirmButtonText: 'Confirmar cierre', loadingTitle: 'Confirmando cierre…', successTitle: 'Cierre mensual confirmado', errorTitle: 'No se pudo confirmar el cierre', getErrorMessage: cierreMensualError,
        action: async () => {
          try { snapshot = await confirmClosing(repository, { anio: year, mes: month, ...(trimmed ? { observaciones: trimmed } : {}) }) }
          catch (reason) {
            if (cierreMensualStatus(reason) === 409) {
              await Promise.all([loadHistory(), loadPreview()])
              setError('El cierre fue confirmado concurrentemente o el período ya se cerró. Se actualizaron el historial y el preview para consultar el snapshot disponible. No se reintentó la confirmación.')
            }
            throw reason
          }
        },
      })
      if (confirmed && snapshot) { setSelected(snapshot); setObservations(''); await loadHistory() }
    } finally { setConfirming(false) }
  }

  return <section className="monthly-closing-page">
    <div className="page-heading"><div><p className="eyebrow">FINANZAS / CAJA / CORTES</p><h1><CalendarDays size={25} aria-hidden="true" /> Cierres mensuales</h1><p className="muted">Revisá el preview del período y consultá snapshots históricos sin recalcularlos.</p></div></div>
    <div className="monthly-closing-layout">
      <div>
        <div className="panel monthly-closing-period"><div className="monthly-closing-period-fields"><label htmlFor="closing-year">Año<input id="closing-year" type="number" min="2000" max="9999" value={year} onChange={event => setYear(Number(event.target.value))} /></label><label htmlFor="closing-month">Mes<select id="closing-month" value={month} onChange={event => setMonth(Number(event.target.value))}>{monthNames.map((name, index) => <option value={index + 1} key={name}>{name}</option>)}</select></label></div><button className="secondary-button" type="button" onClick={() => void loadPreview()} disabled={loadingPreview}><RefreshCw size={16} aria-hidden="true" /> Actualizar preview</button></div>
        {error && <div className="panel monthly-closing-error" role="alert"><strong>No se pudo cargar el cierre mensual</strong><span>{error}</span>{previewStatus === 404 && <Link className="secondary-button" to="/configuracion/financiera">Ir a configuración financiera</Link>}<button className="secondary-button" type="button" onClick={() => { void loadPreview(); void loadHistory() }}>Reintentar</button></div>}
        {loadingPreview && <div className="panel monthly-closing-state" role="status"><LoaderCircle className="spin" size={17} /> Cargando preview…</div>}
        {!loadingPreview && preview && <PreviewPanel preview={preview} observations={observations} setObservations={setObservations} onConfirm={() => void confirm()} confirming={confirming} />}
      </div>
      <HistoryPanel history={history} loading={loadingHistory} onOpen={async id => { try { setSelected(await getClosingSnapshot(repository, id)) } catch (reason) { setError(cierreMensualError(reason)) } }} />
    </div>
    {selected && <SnapshotModal snapshot={selected} onClose={() => setSelected(null)} />}
  </section>
}

function PreviewPanel({ preview, observations, setObservations, onConfirm, confirming }: { preview: ClosingPreview; observations: string; setObservations: (value: string) => void; onConfirm: () => void; confirming: boolean }) {
  const ready = preview.puedeConfirmar && preview.canClose && preview.estadoDocumental === 'LISTO_PARA_CONFIRMAR'
  return <div className="monthly-closing-preview"><div className="panel monthly-closing-status"><div><span className="eyebrow">PREVIEW DINÁMICA</span><h2>{formatDateOnly(preview.fechaInicio)} al {formatDateOnly(preview.fechaFin)}</h2></div><span className={`closing-status ${ready ? 'ready' : 'pending'}`}>{ready ? 'LISTO PARA CONFIRMAR' : 'PENDIENTE DE CONFIRMACIÓN'}</span></div>{!ready && <div className="monthly-closing-warning" role="status"><ShieldCheck size={19} aria-hidden="true" /><div><strong>El mes aún no está finalizado o tiene validaciones pendientes.</strong><p>{preview.errors.length ? preview.errors.join(' ') : 'El botón de confirmación permanecerá deshabilitado hasta que el contrato permita cerrar el período.'}</p></div></div>}<CierreMensualFinancialView model={preview} /><div className="panel monthly-closing-observations"><label htmlFor="closing-observations">Observaciones <span>(opcional)</span><textarea id="closing-observations" maxLength={1000} value={observations} onChange={event => setObservations(event.target.value)} placeholder="Agregá una observación para el snapshot…" /></label><button className="primary-button" type="button" disabled={!ready || confirming} onClick={onConfirm}>{confirming ? 'Confirmando cierre…' : 'Confirmar cierre mensual'}</button></div></div>
}

function HistoryPanel({ history, loading, onOpen }: { history: ClosingSnapshot[]; loading: boolean; onOpen: (id: number) => void }) { return <div className="panel monthly-closing-history"><div className="panel-title"><div><span className="eyebrow">SNAPSHOTS INMUTABLES</span><h2>Históricos</h2></div></div>{loading ? <p className="monthly-closing-state" role="status">Cargando históricos…</p> : history.length === 0 ? <p className="monthly-closing-state">No hay cierres mensuales confirmados.</p> : <div className="monthly-closing-history-list">{history.map(item => <button type="button" className="monthly-closing-history-item" key={item.id} onClick={() => onOpen(item.id)}><span>{monthNames[item.mes - 1]} {item.anio}</span><small>{formatDateOnly(item.fechaInicio)} — {formatDateOnly(item.fechaFin)}</small><strong>{formatCRC(item.detalles.find(detail => detail.concepto === 'RESULTADO_MES')?.monto ?? 0)}</strong><Eye size={16} aria-hidden="true" /></button>)}</div>}</div> }

function SnapshotModal({ snapshot, onClose }: { snapshot: ClosingSnapshot; onClose: () => void }) { return <div className="monthly-closing-backdrop" role="presentation"><div className="monthly-closing-modal" role="dialog" aria-modal="true" aria-labelledby="closing-snapshot-title"><header><div><span className="eyebrow">HISTÓRICO READ-ONLY</span><h2 id="closing-snapshot-title">Cierre de {monthNames[snapshot.mes - 1]} {snapshot.anio}</h2></div><button className="table-action" type="button" onClick={onClose} aria-label="Cerrar detalle"><X size={18} /></button></header><div className="monthly-closing-historical-notice" role="note"><strong>Información histórica inmutable</strong><span>Este detalle muestra el snapshot confirmado y no recalcula ni consulta información adicional.</span></div><div className="monthly-closing-meta"><span>ID: <strong>#{snapshot.id}</strong></span><span>Estado: <strong>CIERRE CONFIRMADO</strong></span><span>Período: <strong>{formatDateOnly(snapshot.fechaInicio)} al {formatDateOnly(snapshot.fechaFin)}</strong></span><span>fechaInicio: <strong>{formatDateOnly(snapshot.fechaInicio)}</strong></span><span>fechaFin: <strong>{formatDateOnly(snapshot.fechaFin)}</strong></span><span>fechaCierre: <strong>{formatDateOnly(snapshot.fechaCierre)}</strong></span><span>usuarioCierreId: <strong>#{snapshot.usuarioCierreId}</strong></span><span>Metadato de creación: <strong>{formatDateOnly(snapshot.fechaCreacion)}</strong></span><span>Observaciones: <strong>{snapshot.observaciones || '—'}</strong></span></div><CierreMensualFinancialView model={snapshot} /></div></div> }
