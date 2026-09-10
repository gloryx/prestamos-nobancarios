import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRightLeft,
  Banknote,
  CalendarClock,
  CalendarDays,
  FileText,
  Link2,
  RefreshCw,
  Search,
  SearchX,
  TrendingUp,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Cliente } from "@/features/clientes/domain/cliente.types";
import { ClientePicker } from "./ClientePicker";
import { listarRefinanciamientos } from "../application/refinanciamientos.use-cases";
import type { RefinanciamientoListFilters, RefinanciamientoPage } from "../domain/refinanciamiento.types";
import { AxiosRefinanciamientoRepository } from "../infrastructure/axios-refinanciamiento.repository";
import { formatCRC } from "@/shared/utils/currency";
import { Pagination } from "@/shared/components/Pagination";
import "./refinanciamientos.css";

const repository = new AxiosRefinanciamientoRepository();
const dateLabel = (value: string) => value ? value.slice(0, 10).split("-").reverse().join("/") : "—";
const daysLabel = (value: number | null) => value === null ? "—" : `${value} ${value === 1 ? "día" : "días"}`;
const nombreCliente = (cliente: Cliente) => [cliente.primerNombre, cliente.segundoNombre, cliente.primerApellido, cliente.segundoApellido].filter(Boolean).join(" ");

export function RefinanciamientosPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState<RefinanciamientoPage | null>(null);
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(10);
  const [buscar, setBuscar] = useState("");
  const [debounced, setDebounced] = useState("");
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const requestId = useRef(0);
  useEffect(() => { const timer = window.setTimeout(() => { setDebounced(buscar.trim()); setPagina(1); }, 350); return () => window.clearTimeout(timer); }, [buscar]);
  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true); setError(false);
    const filters: RefinanciamientoListFilters = { pagina, limite };
    if (debounced) filters.buscar = debounced;
    if (cliente) filters.clienteId = cliente.id;
    if (fechaDesde) filters.fechaDesde = fechaDesde;
    if (fechaHasta) filters.fechaHasta = fechaHasta;
    try { const result = await listarRefinanciamientos(repository, filters); if (id === requestId.current) setPage(result); }
    catch { if (id === requestId.current) { setPage(null); setError(true); } }
    finally { if (id === requestId.current) setLoading(false); }
  }, [cliente, debounced, fechaDesde, fechaHasta, limite, pagina]);
  useEffect(() => { void load(); }, [load]);
  const resetFilterPage = () => setPagina(1);
  const clearClient = () => { setCliente(null); resetFilterPage(); };
  return <section className="refinanciamientos-page">
    <div className="page-heading"><div><p className="eyebrow">REFINANCIAMIENTOS</p><h1><RefreshCw size={24} aria-hidden="true" /> Refinanciamientos</h1><p className="muted">Consulta y analiza las operaciones de refinanciamiento registradas.</p></div></div>
    <div className="panel refinanciamientos-filters">
      <label><span className="filter-label"><Search size={15} aria-hidden="true" /> Buscar</span><input placeholder="Cliente o número de préstamo" value={buscar} onChange={(event) => setBuscar(event.target.value)} /></label>
      <div className="refinanciamiento-client-filter"><span className="filter-label"><UserRound size={15} aria-hidden="true" /> Cliente</span>{cliente ? <div className="selected-refinanciamiento-client"><strong>{nombreCliente(cliente)}</strong><button type="button" className="table-action" title="Quitar cliente" aria-label="Quitar cliente" onClick={clearClient}><X size={15} aria-hidden="true" /></button></div> : <ClientePicker onSelect={(value) => { setCliente(value); resetFilterPage(); }} />}</div>
      <label><span className="filter-label"><CalendarDays size={15} aria-hidden="true" /> Fecha desde</span><input type="date" value={fechaDesde} onChange={(event) => { setFechaDesde(event.target.value); resetFilterPage(); }} /></label>
      <label><span className="filter-label"><CalendarDays size={15} aria-hidden="true" /> Fecha hasta</span><input type="date" value={fechaHasta} onChange={(event) => { setFechaHasta(event.target.value); resetFilterPage(); }} /></label>
    </div>
    {loading && <div className="panel state-box" role="status">Cargando refinanciamientos...</div>}
    {!loading && error && <div className="panel refinanciamientos-error" role="alert"><p>No se pudo cargar el listado de refinanciamientos.</p><button type="button" className="secondary-button" onClick={() => void load()}><RefreshCw size={15} /> Reintentar</button></div>}
    {!loading && !error && page && page.datos.length === 0 && <div className="panel state-box refinanciamientos-empty"><SearchX size={30} aria-hidden="true" /><span>No hay refinanciamientos que coincidan con los filtros seleccionados.</span></div>}
    {!loading && !error && page && page.datos.length > 0 && <>
       <div className="panel refinanciamientos-table-wrap"><div className="table-wrap"><table className="refinanciamientos-table"><thead><tr><th title="Fecha en que se registró la operación."><CalendarDays size={14} aria-hidden="true" /> Fecha</th><th className="client-primary"><UserRound size={14} aria-hidden="true" /> Cliente</th><th className="loan-id-origin" title="Identificador del préstamo cuyo saldo fue refinanciado."><FileText size={14} aria-hidden="true" /> Préstamo origen</th><th className="capital-transferred" title="Capital pendiente trasladado desde el préstamo anterior."><ArrowRightLeft size={14} aria-hidden="true" /> Capital trasladado</th><th className="new-money" title="Dinero nuevo entregado al cliente en esta refinanciación."><Banknote size={14} aria-hidden="true" /> Dinero nuevo</th><th title="Capital del nuevo préstamo."><WalletCards size={14} aria-hidden="true" /> Capital nuevo</th><th className="new-interest" title="Interés nuevo pactado para el préstamo."><TrendingUp size={14} aria-hidden="true" /> Interés nuevo</th><th className="days-earned" title="Días de anticipación con que se inició la nueva operación respecto al vencimiento previsto del préstamo anterior."><CalendarClock size={14} aria-hidden="true" /> Días ganados</th><th className="loan-id-new" title="Identificador del préstamo creado por la refinanciación."><FileText size={14} aria-hidden="true" /> Préstamo nuevo</th><th>Acción</th></tr></thead><tbody>{page.datos.map((item) => { const dineroNuevo = item.prestamoNuevo?.montoDesembolsado ?? item.nuevaOperacion?.dineroNuevoDesembolsado ?? 0; return <tr key={item.id}><td>{dateLabel(item.fecha)}</td><td className="client-primary">{item.cliente.nombreCompleto}</td><td className="loan-id-origin"><span className="loan-id-badge">#{item.prestamoOrigenId}</span></td><td className="capital-transferred">{formatCRC(item.capitalPendiente)}</td><td className="new-money">{formatCRC(dineroNuevo)}</td><td>{formatCRC(item.prestamoNuevo?.capital ?? 0)}</td><td className="new-interest">{formatCRC(item.interesNuevo)}</td><td className="days-earned">{daysLabel(item.diasGanados)}</td><td className="loan-id-new"><span className="loan-id-badge loan-id-badge-new">#{item.prestamoNuevoId}</span></td><td><button type="button" className="table-action" title='Ver cadena' aria-label="Ver cadena de refinanciamiento" onClick={() => navigate("/refinanciamientos/cadenas", { state: { clienteId: item.cliente.id, prestamoOrigenId: item.prestamoOrigenId, prestamoNuevoId: item.prestamoNuevoId } })}><Link2 size={16} aria-hidden="true" /></button></td></tr>; })}</tbody></table></div></div>
      <Pagination pagina={page.pagina} totalPaginas={page.totalPaginas} total={page.total} limite={page.limite} opcionesLimite={[10, 20, 50]} onPageChange={setPagina} onLimitChange={(value) => { setLimite(value); setPagina(1); }} label="refinanciamientos" loading={loading} />
    </>}
  </section>;
}
