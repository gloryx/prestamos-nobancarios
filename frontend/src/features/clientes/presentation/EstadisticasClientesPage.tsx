import { useCallback, useEffect, useRef, useState } from 'react'
import { BarChart3, FileDown, RefreshCw } from 'lucide-react'
import { formatCRC } from '@/shared/utils/currency'
import { generarEstadisticasClientesPdf } from '../application/estadisticas-clientes-pdf'
import { obtenerEstadisticasClientes } from '../application/estadisticas-clientes.use-cases'
import type { EstadisticasClientesOrden, EstadisticasClientesResponse, EstadisticasClientesTop } from '../domain/estadisticas-clientes.types'
import { AxiosEstadisticasClientesRepository } from '../infrastructure/axios-estadisticas-clientes.repository'
import './estadisticas-clientes.css'

const repository = new AxiosEstadisticasClientesRepository()
const labels: Record<EstadisticasClientesOrden, string> = { cantidadPrestamos: 'Cantidad de préstamos', totalPrestado: 'Monto prestado', gananciaCobrada: 'Ganancia cobrada' }

export function EstadisticasClientesPage() {
  const [orden, setOrden] = useState<EstadisticasClientesOrden>('cantidadPrestamos')
  const [top, setTop] = useState<EstadisticasClientesTop>('10')
  const [report, setReport] = useState<EstadisticasClientesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pdfError, setPdfError] = useState('')
  const requestId = useRef(0)
  const load = useCallback(async () => {
    const id = ++requestId.current; setLoading(true); setError('')
    try { const result = await obtenerEstadisticasClientes(repository, orden, top); if (id === requestId.current) setReport(result) } catch { if (id === requestId.current) { setReport(null); setError('No se pudieron cargar las estadísticas de clientes.') } } finally { if (id === requestId.current) setLoading(false) }
  }, [orden, top])
  useEffect(() => { void load() }, [load])
  const exportPdf = () => { if (!report?.datos.length) return; setPdfError(''); try { generarEstadisticasClientesPdf(report) } catch { setPdfError('No se pudo generar el PDF.') } }
  return <main className="estadisticas-clientes-page">
    <div className="page-heading"><div><p className="eyebrow">CLIENTES</p><h1><BarChart3 size={25} aria-hidden="true" /> Estadísticas compactas de clientes</h1><p className="muted">Ranking histórico de clientes con datos reales de préstamos y pagos registrados.</p></div></div>
    <div className="panel estadisticas-clientes-toolbar"><label>Estadística<select value={orden} onChange={(event) => setOrden(event.target.value as EstadisticasClientesOrden)}><option value="cantidadPrestamos">Cantidad de préstamos</option><option value="totalPrestado">Monto prestado</option><option value="gananciaCobrada">Ganancia cobrada</option></select></label><label>Top<select value={top} onChange={(event) => setTop(event.target.value as EstadisticasClientesTop)}><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="todos">Todos</option></select></label><button type="button" className="secondary-button" onClick={exportPdf} disabled={!report?.datos.length}><FileDown size={16} aria-hidden="true" /> Exportar PDF</button></div>
    {loading && <div className="panel state-box" role="status">Cargando estadísticas...</div>}
    {!loading && error && <div className="panel estadisticas-clientes-state" role="alert">{error}<button type="button" className="secondary-button" onClick={() => void load()}><RefreshCw size={15} aria-hidden="true" /> Reintentar</button></div>}
    {!loading && !error && pdfError && <div className="panel estadisticas-clientes-state" role="alert">{pdfError}<button type="button" className="secondary-button" onClick={exportPdf}>Reintentar</button></div>}
    {!loading && !error && report && <div className="panel estadisticas-clientes-table-panel"><div className="estadisticas-clientes-table-wrap"><table><caption>Ranking por {labels[report.orden]}</caption><thead><tr><th>#</th><th>Cliente</th><th>Identificación</th><th>Préstamos</th><th>Total prestado</th><th>Ganancia cobrada</th><th>Antigüedad</th></tr></thead><tbody>{report.datos.map((row) => <tr key={row.clienteId}><td>{row.posicion}</td><th scope="row">{row.cliente}</th><td>{row.identificacion}</td><td>{row.cantidadPrestamos}</td><td>{formatCRC(row.totalPrestado)}</td><td>{formatCRC(row.gananciaCobrada)}</td><td>{row.antiguedad}</td></tr>)}</tbody></table></div></div>}
  </main>
}
