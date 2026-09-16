import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, RefreshCw } from 'lucide-react'
import { PrestamoDetailModal } from './PrestamosListPage'
import { listarPrestamos, resumirPrestamos } from '../application/prestamos.use-cases'
import { prestamoErrorMessage } from '../domain/prestamo.error'
import type { Prestamo, PrestamoFilters, PrestamoPage, PrestamoSortDirection, PrestamoSortField, PrestamosResumen } from '../domain/prestamo.types'
import { AxiosPrestamoRepository } from '../infrastructure/axios-prestamo.repository'
import { Pagination } from '@/shared/components/Pagination'
import { formatCRC } from '@/shared/utils/currency'
import { formatDateOnly } from '@/shared/utils/date'
import './saldados.css'
import './prestamos-list.css'

const repository = new AxiosPrestamoRepository()
const limitOptions = [10, 25, 50, 100]

const displayDate = formatDateOnly

function calendarDayNumber(value: string | null | undefined) {
  const match = value && /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000 : null
}

function differenceLabel(cancelled: string | null | undefined, contractual: string | null | undefined) {
  const actualDay = calendarDayNumber(cancelled)
  const contractualDay = calendarDayNumber(contractual)
  if (actualDay === null || contractualDay === null) return '—'
  const difference = actualDay - contractualDay
  return difference === 0 ? 'A tiempo' : difference < 0 ? `${Math.abs(difference)} días antes` : `${difference} días después`
}

export function SaldadosPage() {
  const [page, setPage] = useState<PrestamoPage | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [fechaCancelacionDesde, setFechaCancelacionDesde] = useState('')
  const [fechaCancelacionHasta, setFechaCancelacionHasta] = useState('')
  const [sort, setSort] = useState<PrestamoSortField>('fechaCancelacion')
  const [direction, setDirection] = useState<PrestamoSortDirection>('DESC')
  const [pagina, setPagina] = useState(1)
  const [limite, setLimite] = useState(10)
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<PrestamosResumen | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState('')
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const listRequestId = useRef(0)
  const summaryRequestId = useRef(0)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 350)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => setPagina(1), [debouncedSearch])

  const dateValidation = fechaCancelacionDesde && fechaCancelacionHasta && fechaCancelacionDesde > fechaCancelacionHasta
    ? 'La fecha desde no puede ser posterior a la fecha hasta.'
    : ''

  const buildFilters = useCallback((): Pick<PrestamoFilters, 'estados' | 'buscar' | 'fechaCancelacionDesde' | 'fechaCancelacionHasta'> => ({
    estados: ['CANCELADO'],
    buscar: debouncedSearch.trim() || undefined,
    fechaCancelacionDesde: fechaCancelacionDesde || undefined,
    fechaCancelacionHasta: fechaCancelacionHasta || undefined,
  }), [debouncedSearch, fechaCancelacionDesde, fechaCancelacionHasta])

  const loadList = useCallback(async () => {
    const currentRequest = ++listRequestId.current
    setLoading(true)
    if (dateValidation) {
      setLoading(false)
      setError(dateValidation)
      return
    }
    try {
      const result = await listarPrestamos(repository, {
        pagina,
        limite,
        ...buildFilters(),
        ordenarPor: sort,
        direccionOrden: direction,
      })
      if (currentRequest !== listRequestId.current) return
      const safePage = result.totalPaginas === 0 ? 1 : Math.min(Math.max(1, result.pagina), result.totalPaginas)
      if (safePage !== pagina) setPagina(safePage)
      setPage({ ...result, pagina: safePage })
      setError('')
    } catch (cause: unknown) {
      if (currentRequest === listRequestId.current) setError(prestamoErrorMessage(cause))
    } finally {
      if (currentRequest === listRequestId.current) setLoading(false)
    }
  }, [buildFilters, dateValidation, direction, limite, pagina, sort])

  const loadSummary = useCallback(async () => {
    const currentRequest = ++summaryRequestId.current
    setSummaryLoading(true)
    setSummaryError('')
    if (dateValidation) {
      setSummaryLoading(false)
      return
    }
    try {
      const result = await resumirPrestamos(repository, { pagina: 1, limite: 10, ...buildFilters() })
      if (currentRequest === summaryRequestId.current) setSummary(result)
    } catch {
      if (currentRequest === summaryRequestId.current) setSummaryError('No se pudo cargar el resumen financiero.')
    } finally {
      if (currentRequest === summaryRequestId.current) setSummaryLoading(false)
    }
  }, [buildFilters, dateValidation])

  useEffect(() => { void loadList() }, [loadList])
  useEffect(() => { void loadSummary() }, [loadSummary])

  const sortColumn = (column: PrestamoSortField) => {
    if (sort !== column) {
      setSort(column)
      setDirection('ASC')
    } else setDirection((current) => current === 'ASC' ? 'DESC' : 'ASC')
    setPagina(1)
  }

  const sortIcon = (column: PrestamoSortField) => sort !== column ? <ArrowUpDown size={14} /> : direction === 'ASC' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
  const sortButton = (column: PrestamoSortField, label: string) => <button type="button" className="prestamos-list-sort-button" onClick={() => sortColumn(column)} aria-sort={sort === column ? direction === 'ASC' ? 'ascending' : 'descending' : 'none'}>{label} {sortIcon(column)}</button>

    return <section className="saldados-page">
    <div className="page-heading">
      <div><p className="eyebrow">HISTÓRICO</p><h1>Préstamos saldados</h1><p className="muted">Préstamos CANCELADO ordenados por fecha real de cancelación.</p></div>
      <button className="secondary-button" type="button" onClick={() => { void loadList(); void loadSummary() }} disabled={loading}><RefreshCw size={16} /> Actualizar</button>
    </div>
    <div className="panel saldados-toolbar">
      <label>Cliente<input value={search} placeholder="Nombre completo, identificación, teléfono o dirección" onChange={(event) => { setSearch(event.target.value); setPagina(1) }} /></label>
      <label>Fecha cancelación desde<input type="date" value={fechaCancelacionDesde} onChange={(event) => { setFechaCancelacionDesde(event.target.value); setPagina(1) }} /></label>
      <label>Fecha cancelación hasta<input type="date" value={fechaCancelacionHasta} onChange={(event) => { setFechaCancelacionHasta(event.target.value); setPagina(1) }} /></label>
    </div>
    <div className="prestamos-financial-summary" aria-label="Resumen financiero de préstamos saldados">
      <div><span>TOTAL</span><strong>{summary ? summary.total.toLocaleString('es-CR') : '—'}</strong></div>
      <div><span>PRESTADO</span><strong>{summary ? formatCRC(summary.prestado) : '—'}</strong></div>
      <div><span>GANANCIA</span><strong>{summary ? formatCRC(summary.ganancia) : '—'}</strong></div>
      {summaryLoading && <small aria-live="polite">Cargando...</small>}
      {summaryError && <small className="prestamos-financial-summary-error" role="alert">{summaryError}</small>}
    </div>
    {error && <div className="panel saldados-state" role="alert"><p>{error}</p><button className="secondary-button" type="button" onClick={() => void loadList()}>Reintentar</button></div>}
    {!error && loading && !page && <div className="panel saldados-state">Cargando préstamos saldados...</div>}
    {!error && !loading && page && page.datos.length === 0 && <div className="panel saldados-state">No se encontraron préstamos saldados.</div>}
     {page && page.datos.length > 0 && <div className="panel table-wrap saldados-table-wrap"><table className="saldados-table"><thead><tr><th>{sortButton('id', 'Nº')}</th><th>Cliente</th><th>Teléfono</th><th>{sortButton('fechaAlta', 'Fecha alta')}</th><th>Fecha estimada</th><th>{sortButton('fechaCancelacion', 'CANCELACIÓN REAL')}</th><th>Capital</th><th>Interés</th><th>Total</th><th>Diferencia</th><th>Acción</th></tr></thead><tbody>{page.datos.map((loan: Prestamo) => <tr key={loan.id}><td>#{loan.id}</td><td><strong>{loan.cliente.nombreCompleto}</strong></td><td>{loan.cliente.telefono || '—'}</td><td>{displayDate(loan.fechaAlta)}</td><td>{displayDate(loan.fechaLimiteContractual)}</td><td>{displayDate(loan.fechaCancelacion)}</td><td>{formatCRC(loan.capital)}</td><td>{formatCRC(loan.interes)}</td><td>{formatCRC(loan.montoTotal)}</td><td>{differenceLabel(loan.fechaCancelacion, loan.fechaLimiteContractual)}</td><td><button className="table-action" type="button" title="Ver préstamo" aria-label={`Ver préstamo ${loan.id}`} onClick={() => setSelected(loan.id)}><Eye size={16} /></button></td></tr>)}</tbody></table></div>}
    {page && <Pagination pagina={page.pagina} totalPaginas={page.totalPaginas} total={page.total} limite={page.limite} opcionesLimite={limitOptions} onPageChange={setPagina} onLimitChange={(value) => { setLimite(value); setPagina(1) }} label="préstamos saldados" loading={loading} />}
    {selected !== null && <PrestamoDetailModal prestamoId={selected} onClose={() => setSelected(null)} />}
  </section>
}
