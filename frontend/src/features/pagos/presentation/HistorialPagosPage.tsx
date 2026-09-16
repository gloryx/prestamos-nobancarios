import { useEffect, useRef, useState } from 'react'
import { Download, Eye } from 'lucide-react'
import { Pagination } from '@/shared/components/Pagination'
import { formatCRC } from '@/shared/utils/currency'
import { formatDateOnly, todayInCostaRica } from '@/shared/utils/date'
import { AxiosPagoRepository } from '@/features/prestamos/infrastructure/axios-pago.repository'
import { AxiosFormaPagoRepository } from '@/features/formas-pago/infrastructure/axios-forma-pago.repository'
import { AxiosUsuarioRepository } from '@/features/usuarios/infrastructure/axios-usuario.repository'
import type { Pago, PagosHistoryFilters, PagosPage } from '@/features/prestamos/domain/pago.types'
import './historial-pagos.css'

const pagos = new AxiosPagoRepository()
const formas = new AxiosFormaPagoRepository()
const usuarios = new AxiosUsuarioRepository()
const today = todayInCostaRica()
const defaults = { fechaDesde: `${today.slice(0, 8)}01`, fechaHasta: today, estado: 'TODOS' as const }

export function HistorialPagosPage() {
  const [filters, setFilters] = useState<PagosHistoryFilters>({ pagina: 1, limite: 10, ...defaults })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState<PagosPage | null>(null)
  const [catalogs, setCatalogs] = useState<{ formas: { id: number; nombre: string }[]; usuarios: { id: number; nombreCompleto: string }[] }>({ formas: [], usuarios: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pdfError, setPdfError] = useState('')
  const [exportingPdf, setExportingPdf] = useState(false)
  const [selected, setSelected] = useState<Pago | null>(null)
  const sequence = useRef(0)

  useEffect(() => { void Promise.all([formas.list(), usuarios.listSelector()]).then(([f, u]) => setCatalogs({ formas: f, usuarios: u })).catch(() => setError('No se pudieron cargar los catálogos.')) }, [])
  useEffect(() => { const timer = window.setTimeout(() => setFilters(current => ({ ...current, pagina: 1, buscar: search.trim() || undefined })), 350); return () => window.clearTimeout(timer) }, [search])
  useEffect(() => { const current = ++sequence.current; setLoading(true); setError(''); void pagos.listPage(filters).then(result => { if (current === sequence.current) setPage(result) }).catch(() => { if (current === sequence.current) setError('No se pudo cargar el historial de pagos.') }).finally(() => { if (current === sequence.current) setLoading(false) }) }, [filters])

  const change = (key: keyof PagosHistoryFilters, value: string | number | undefined) => setFilters(current => ({ ...current, [key]: value || undefined, pagina: 1 }))
  const clear = () => { setSearch(''); setFilters(current => ({ pagina: 1, limite: current.limite, ...defaults })) }
  const exportPdf = async () => {
    if (exportingPdf || !page?.total) return
    setExportingPdf(true); setPdfError('')
    try {
      const { blob, filename } = await pagos.exportPdf(filters)
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url)
    } catch { setPdfError('No se pudo generar el PDF del historial.') } finally { setExportingPdf(false) }
  }

  return <section className="history-payments-page">
    <div className="page-heading"><div><p className="eyebrow">PAGOS</p><h1>Historial de pagos</h1><p className="muted">Consulta operativa y auditable de pagos históricos.</p></div><button className="secondary-button" type="button" onClick={() => void exportPdf()} disabled={exportingPdf || !page?.total}><Download size={16} aria-hidden="true" /> {exportingPdf ? 'Generando PDF…' : 'Exportar PDF'}</button></div>
    <div className="panel history-filters"><label>Desde<input type="date" value={filters.fechaDesde ?? ''} onChange={e => change('fechaDesde', e.target.value)} /></label><label>Hasta<input type="date" value={filters.fechaHasta ?? ''} onChange={e => change('fechaHasta', e.target.value)} /></label><label>Cliente<input value={search} placeholder="Nombre, identificación o teléfono" onChange={e => setSearch(e.target.value)} /></label><label>Préstamo ID<input type="number" min="1" value={filters.prestamoId ?? ''} onChange={e => change('prestamoId', Number(e.target.value))} /></label><label>Estado<select value={filters.estado ?? 'TODOS'} onChange={e => change('estado', e.target.value as PagosHistoryFilters['estado'])}><option value="TODOS">Todos</option><option value="REGISTRADO">Registrado</option><option value="ANULADO">Anulado</option></select></label><label>Forma<select value={filters.formaPagoId ?? ''} onChange={e => change('formaPagoId', Number(e.target.value))}><option value="">Todas</option>{catalogs.formas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}</select></label><label>Cobrador<select value={filters.cobradorId ?? ''} onChange={e => change('cobradorId', Number(e.target.value))}><option value="">Todos</option>{catalogs.usuarios.map(u => <option key={u.id} value={u.id}>{u.nombreCompleto}</option>)}</select></label><button className="secondary-button" type="button" onClick={clear}>Limpiar filtros</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}{pdfError && <p className="form-error" role="alert">{pdfError}</p>}
    {page && <><div className="history-cards">{[['Pagos válidos', page.totales.cantidadPagos.toLocaleString('es-CR')], ['Total recibido', formatCRC(page.totales.totalRecibido)], ['Capital aplicado', formatCRC(page.totales.capitalAplicado)], ['Interés aplicado', formatCRC(page.totales.interesAplicado)]].map(([label, value]) => <div className="panel" key={label}><span className="muted">{label}</span><strong>{value}</strong></div>)}</div><div className="panel table-wrap"><table><thead><tr><th>Fecha</th><th>Cliente</th><th>Préstamo</th><th>Cuota</th><th>Monto</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{page.datos.map(pago => <tr key={pago.id}><td>{formatDateOnly(pago.fecha)}</td><td>{pago.cliente?.nombreCompleto ?? '—'}<small>{pago.cliente?.identificacion ?? '—'}</small></td><td>#{pago.prestamoId}</td><td>{pago.numeroCuota ?? '—'}</td><td>{formatCRC(pago.monto)}</td><td><span className={`payment-status ${pago.estado === 'ANULADO' ? 'annulled' : ''}`}>{pago.estado}</span></td><td><button className="table-action" type="button" onClick={() => setSelected(pago)} aria-label={`Ver pago ${pago.id}`}><Eye size={16} /></button></td></tr>)}</tbody></table></div><Pagination pagina={page.pagina} totalPaginas={page.totalPaginas} total={page.total} limite={page.limite} opcionesLimite={[10, 25, 50, 100]} onPageChange={pagina => setFilters(current => ({ ...current, pagina }))} onLimitChange={limite => setFilters(current => ({ ...current, limite, pagina: 1 }))} label="pagos" loading={loading} /></>}
    {selected && <PaymentDetail pago={selected} onClose={() => setSelected(null)} />}
  </section>
}

function PaymentDetail({ pago, onClose }: { pago: Pago; onClose: () => void }) { const annul = pago.estado === 'ANULADO'; return <div className="payment-modal-backdrop" role="presentation"><div className="payment-modal" role="dialog" aria-modal="true" aria-labelledby="history-detail-title"><header className="payment-modal-header"><h2 id="history-detail-title">Detalle del pago #{pago.id}</h2><button className="table-action" type="button" onClick={onClose} aria-label="Cerrar">×</button></header><p>Fecha de pago: <strong>{formatDateOnly(pago.fecha)}</strong></p><p>Vencimiento programado: <strong>{formatDateOnly(pago.fechaVencimiento)}</strong></p><p>Observaciones: <strong>{pago.observaciones || '—'}</strong></p>{annul && <section><h3>Anulación</h3><p>Fecha: {formatDateOnly(pago.anulacion?.fecha)}</p><p>Motivo: {pago.anulacion?.motivo ?? '—'}</p><p>Usuario: {pago.usuarioAnulacion?.nombreCompleto ?? '—'}</p><p>Observación: {pago.anulacion?.observacion ?? '—'}</p></section>}</div></div> }
