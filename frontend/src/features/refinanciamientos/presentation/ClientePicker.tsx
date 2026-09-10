import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { listarClientes } from "@/features/clientes/application/clientes.use-cases";
import { clienteErrorMessage } from "@/features/clientes/domain/cliente.error";
import type { Cliente, ClienteFilters, ClientePage } from "@/features/clientes/domain/cliente.types";
import { AxiosClienteRepository } from "@/features/clientes/infrastructure/axios-cliente.repository";
import "@/features/clientes/presentation/analisis-financiero-cliente.css";

const repository = new AxiosClienteRepository();
const nombreCliente = (cliente: Cliente) => [cliente.primerNombre, cliente.segundoNombre, cliente.primerApellido, cliente.segundoApellido].filter(Boolean).join(" ");

export function ClientePicker({ onSelect }: { onSelect: (cliente: Cliente) => void }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<ClientePage | null>(null);
  const [buscar, setBuscar] = useState("");
  const [debounced, setDebounced] = useState("");
  const [pagina, setPagina] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    const filters: ClienteFilters = { pagina, limite: 10 };
    if (debounced) filters.buscar = debounced;
    try {
      const result = await listarClientes(repository, filters);
      if (id === requestId.current) setPage(result);
    } catch (cause) {
      if (id === requestId.current) { setPage(null); setError(clienteErrorMessage(cause)); }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [debounced, pagina]);
  useEffect(() => {
    const timer = window.setTimeout(() => { setDebounced(buscar.trim()); setPagina(1); }, 350);
    return () => window.clearTimeout(timer);
  }, [buscar]);
  useEffect(() => { if (open) void load(); }, [load, open]);
  return <>
    <button type="button" className="secondary-button" onClick={() => setOpen(true)}><Search size={16} /> Buscar cliente</button>
    {open && <div className="cliente-selector-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="cliente-selector-modal" role="dialog" aria-modal="true" aria-labelledby="refinanciamientos-selector-title">
        <div className="cliente-selector-header"><h2 id="refinanciamientos-selector-title">Seleccionar cliente</h2><button type="button" className="table-action" onClick={() => setOpen(false)} aria-label="Cerrar selector de cliente"><X size={19} /></button></div>
        <label className="analisis-client-search">Nombre o identificación<input value={buscar} placeholder="Buscar por nombre o identificación" onChange={(event) => setBuscar(event.target.value)} /></label>
        {loading && <div className="state-box" role="status">Cargando clientes...</div>}
        {!loading && error && <div className="cliente-selector-error" role="alert"><p>{error}</p><button type="button" className="secondary-button" onClick={() => void load()}>Reintentar</button></div>}
        {!loading && !error && page && <div className="table-wrap cliente-selector-table-wrap"><table className="cliente-selector-table"><thead><tr><th>Identificación</th><th>Nombre</th><th>Acción</th></tr></thead><tbody>{page.datos.map((cliente) => <tr key={cliente.id}><td>{cliente.identificacion}</td><td>{nombreCliente(cliente)}</td><td><button type="button" className="primary-button" onClick={() => { onSelect(cliente); setOpen(false); }}>Seleccionar</button></td></tr>)}</tbody></table>{!page.datos.length && <p className="form-note">No hay clientes para mostrar.</p>}</div>}
        {!loading && !error && page && <div className="cliente-selector-pagination"><button type="button" className="table-action" aria-label="Página anterior" disabled={pagina <= 1} onClick={() => setPagina((value) => value - 1)}><ChevronLeft size={16} /></button><span>Página {pagina} de {Math.max(page.totalPaginas, 1)} · {page.total} clientes</span><button type="button" className="table-action" aria-label="Página siguiente" disabled={pagina >= page.totalPaginas} onClick={() => setPagina((value) => value + 1)}><ChevronRight size={16} /></button></div>}
      </div>
    </div>}
  </>;
}
