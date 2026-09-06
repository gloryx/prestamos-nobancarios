import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Eye, Pencil, Plus, Power, X } from "lucide-react";
import { useAuth } from "@/app/providers/auth-context";
import {
  cambiarEstadoCliente,
  actualizarCliente,
  crearCliente,
  listarClientes,
  obtenerCliente,
} from "../application/clientes.use-cases";
import { clienteErrorMessage } from "../domain/cliente.error";
import type {
  Cliente,
  ClienteFilters,
  ClienteInput,
  ClientePage,
} from "../domain/cliente.types";
import { AxiosClienteRepository } from "../infrastructure/axios-cliente.repository";
import { ClienteForm } from "./ClienteForm";
import { confirmAction } from "@/shared/utils/sweet-alert";

const repository = new AxiosClienteRepository();
type SortColumn = "name" | "address";
type SortDirection = "asc" | "desc";

const clienteNombre = (cliente: Cliente) => [
  cliente.primerNombre,
  cliente.segundoNombre,
  cliente.primerApellido,
  cliente.segundoApellido,
].filter(Boolean).join(" ");

const displayValue = (value: string | null | undefined) => value || "—";
const parseCalendarDate = (value: string | null | undefined) => {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
};
const displayDate = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = parseCalendarDate(value);
  return date ? date.toLocaleDateString("es-CR") : value;
};
const clienteAntiguedad = (fechaIngreso: string | null | undefined) => {
  const ingreso = parseCalendarDate(fechaIngreso);
  if (!ingreso) return "-";
  const today = new Date();
  const actual = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (ingreso > actual) return "-";

  let years = actual.getFullYear() - ingreso.getFullYear();
  let months = actual.getMonth() - ingreso.getMonth();
  if (actual.getDate() < ingreso.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? "año" : "años"}`);
  if (months > 0 || parts.length === 0) parts.push(`${months} ${months === 1 ? "mes" : "meses"}`);
  return parts.join(" y ");
};
const generoLabel = (value: Cliente["genero"]) => ({ FEMENINO: "Femenino", MASCULINO: "Masculino" } as Record<string, string>)[value ?? ""] ?? "—";
const nacionalidadLabel = (value: Cliente["nacionalidad"]) => ({
  COSTARRICENSE: "Costarricense",
  NICARAGUENSE: "Nicaragüense",
  PANAMEÑO: "Panameño",
  ARABE: "Árabe",
} as Record<string, string>)[value ?? ""] ?? "—";

function ClienteDetailModal({
  cliente,
  imageUrl,
  onClose,
  onNewLoan,
}: {
  cliente: Cliente;
  imageUrl: string | null;
  onClose: () => void;
  onNewLoan: () => void;
}) {
  return (
    <div className="cliente-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="cliente-detail-modal" role="dialog" aria-modal="true" aria-labelledby="cliente-detail-title">
        <div className="cliente-detail-header">
          <div>
            <p className="eyebrow">DETALLE DEL CLIENTE</p>
            <h2 id="cliente-detail-title">{clienteNombre(cliente)}</h2>
          </div>
          <button className="table-action" type="button" onClick={onClose} aria-label="Cerrar detalle del cliente">
            <X size={19} />
          </button>
        </div>
        <div className="cliente-detail-content">
          <div className="cliente-detail-image-wrap">
            {imageUrl ? <img className="cliente-detail-image" src={imageUrl} alt={`Identificación de ${clienteNombre(cliente)}`} /> : <span className="form-note">Imagen no disponible.</span>}
          </div>
          <div className="cliente-detail-grid">
            <DetailItem label="Identificación" value={cliente.identificacion} />
            <DetailItem label="Nombre completo" value={clienteNombre(cliente)} />
            <DetailItem label="Género" value={generoLabel(cliente.genero)} />
            <DetailItem label="Fecha de nacimiento" value={displayDate(cliente.fechaNacimiento)} />
            <DetailItem label="Nacionalidad" value={nacionalidadLabel(cliente.nacionalidad)} />
            <DetailItem label="Teléfono 1" value={cliente.telefono1} />
            <DetailItem label="Teléfono 2" value={displayValue(cliente.telefono2)} />
            <DetailItem label="Correo" value={displayValue(cliente.correo)} />
            <DetailItem label="Fecha de ingreso" value={displayDate(cliente.fechaIngreso)} />
            <DetailItem label="Antigüedad como cliente" value={clienteAntiguedad(cliente.fechaIngreso)} />
            <DetailItem label="Estado" value={cliente.activo ? "Activo" : "Inactivo"} />
            <DetailItem className="cliente-detail-wide" label="Dirección" value={displayValue(cliente.direccion)} />
            <DetailItem className="cliente-detail-wide" label="Observaciones" value={displayValue(cliente.observaciones)} />
          </div>
        </div>
        <div className="cliente-detail-actions">
          <button className="primary-button" type="button" onClick={onNewLoan}>Nuevo préstamo</button>
          <button className="secondary-button" type="button" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return <div className={`cliente-detail-item ${className}`}><span>{label}</span><strong>{value}</strong></div>;
}

export function ClientesPage() {
  const { user } = useAuth();
  const isAdmin = user?.rol === "ADMINISTRADOR";
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const editing = Boolean(id);
  const [page, setPage] = useState<ClientePage | null>(null);
  const [detail, setDetail] = useState<Cliente | undefined>();
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Cliente | null>(null);
  const [detailImageUrl, setDetailImageUrl] = useState<string | null>(null);
  const [buscar, setBuscar] = useState("");
  const [direccion, setDireccion] = useState("");
  const [activo, setActivo] = useState("");
  const [pagina, setPagina] = useState(1);
  const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const limite = 10;
  const load = useCallback(async () => {
    setLoading(true);
    const filters: ClienteFilters = { pagina, limite };
    if (buscar.trim()) filters.buscar = buscar.trim();
    if (direccion.trim()) filters.direccion = direccion.trim();
    if (activo) filters.activo = activo === "true";
    try {
      setPage(await listarClientes(repository, filters));
      setError("");
    } catch (cause) {
      setError(clienteErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [activo, buscar, direccion, pagina]);
  useEffect(() => {
    if (!editing) void load();
  }, [editing, load]);
  useEffect(() => {
    if (!id) {
      setDetail(undefined);
      setExistingImageUrl(null);
      setError("");
      setLoading(false);
      return;
    }
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId < 1) {
      setError("El identificador del cliente no es válido.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setExistingImageUrl(null);
    setLoading(true);
    void obtenerCliente(repository, numericId)
      .then(async (value) => {
        if (cancelled) return;
        setDetail(value);
        try {
          const blob = await repository.getIdentificationImage(numericId);
          if (!cancelled) setExistingImageUrl(URL.createObjectURL(blob));
        } catch {
          /* A missing image is a valid edit state. */
        }
        if (!cancelled) {
          setError("");
          setLoading(false);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(clienteErrorMessage(cause));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);
  useEffect(
    () => () => {
      if (existingImageUrl) URL.revokeObjectURL(existingImageUrl);
    },
    [existingImageUrl],
  );
  useEffect(() => {
    if (!selectedClient) {
      return;
    }
    let cancelled = false;
    let imageUrl: string | null = null;
    void repository.getIdentificationImage(selectedClient.id)
      .then((blob) => {
        imageUrl = URL.createObjectURL(blob);
        if (!cancelled) setDetailImageUrl(imageUrl);
      })
      .catch(() => {
        /* A missing image is a valid detail state. */
      });
    return () => {
      cancelled = true;
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [selectedClient]);
  const save = async (input: ClienteInput) => {
    try {
      if (editing && detail) await actualizarCliente(repository, detail.id, input);
      else await crearCliente(repository, input);
      navigate("/clientes");
    } catch (cause) {
      setError(clienteErrorMessage(cause));
    }
  };
  const toggle = async (cliente: Cliente) => {
    const nombre = clienteNombre(cliente);
    const inactivating = cliente.activo;
    const confirmed = await confirmAction({
      title: inactivating ? "¿Inactivar cliente?" : "¿Activar cliente?",
      text: inactivating
        ? `El cliente dejará de estar disponible para nuevas operaciones, pero conservará su información e historial.\n\n${nombre}`
        : `El cliente volverá a estar disponible para nuevas operaciones.\n\n${nombre}`,
      confirmButtonText: inactivating ? "Sí, inactivar" : "Sí, activar",
      loadingTitle: inactivating ? "Inactivando cliente..." : "Activando cliente...",
      successTitle: inactivating ? "Cliente inactivado" : "Cliente activado",
      errorTitle: inactivating ? "No se pudo inactivar el cliente" : "No se pudo activar el cliente",
      getErrorMessage: clienteErrorMessage,
      action: async () => {
        await cambiarEstadoCliente(repository, cliente.id, !cliente.activo);
      },
    });
    if (confirmed) await load();
  };
  const downloadSheet = async (cliente: Cliente) => {
    try {
      const blob = await repository.downloadClientSheet(cliente.id);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `Ficha_Cliente_${cliente.identificacion}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (cause) {
      setError(clienteErrorMessage(cause));
    }
  };
  const toggleSort = (column: SortColumn) => {
    setSort((current) => current?.column === column
      ? { column, direction: current.direction === "asc" ? "desc" : "asc" }
      : { column, direction: "asc" });
  };
  const sortedClientes = page?.datos && sort ? [...page.datos].sort((left, right) => {
    const leftValue = sort?.column === "address" ? left.direccion ?? "" : clienteNombre(left);
    const rightValue = sort?.column === "address" ? right.direccion ?? "" : clienteNombre(right);
    const comparison = leftValue.localeCompare(rightValue, "es", { sensitivity: "base" });
    return sort?.direction === "desc" ? -comparison : comparison;
  }) : page?.datos ?? [];
  if (id || location.pathname.endsWith("/nuevo"))
    return (
      <section>
        <div className="page-heading">
          <div>
            <p className="eyebrow">CLIENTES</p>
            <h1>{editing && detail ? "Editar cliente" : "Nuevo cliente"}</h1>
          </div>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {loading && id ? (
          <div className="panel state-box">Cargando cliente...</div>
        ) : id && !detail ? (
          <div className="panel state-box">
            No se puede editar este cliente.
          </div>
        ) : (
          <div className="panel cliente-panel">
            <ClienteForm
              key={editing ? `edit-${id}` : "new"}
              cliente={editing ? detail : undefined}
              existingImageUrl={editing ? existingImageUrl : null}
              onCancel={() => navigate("/clientes")}
              onSubmit={save}
            />
          </div>
        )}
      </section>
    );
  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">GESTIÓN</p>
          <h1>Clientes</h1>
          <p className="muted">Consultá y administrá la cartera de clientes.</p>
        </div>
        <Link className="primary-button" to="/clientes/nuevo">
          <Plus size={16} /> Nuevo cliente
        </Link>
      </div>
      <div className="panel cliente-filters">
        <input
          value={buscar}
          onChange={(event) => {
            setBuscar(event.target.value);
            setPagina(1);
          }}
          placeholder="Buscar cliente..."
          aria-label="Buscar cliente"
        />
        <input
          value={direccion}
          onChange={(event) => {
            setDireccion(event.target.value);
            setPagina(1);
          }}
          placeholder="Buscar dirección..."
          aria-label="Buscar dirección"
        />
        <select
          value={activo}
          onChange={(event) => {
            setActivo(event.target.value);
            setPagina(1);
          }}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
        <button className="secondary-button" onClick={() => void load()}>
          Buscar
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <div className="panel state-box">Cargando clientes...</div>
      ) : !page?.datos.length ? (
        <div className="panel state-box">No hay clientes para mostrar.</div>
      ) : (
        <>
          <div className="panel table-wrap cliente-panel">
            <table className="clientes-list-table">
              <thead>
                <tr>
                  <th>Identificación</th>
                  <th className="clientes-list-name-column"><button type="button" className="clientes-list-sort-button" onClick={() => toggleSort("name")}>Nombre {sort?.column === "name" && (sort.direction === "asc" ? <ArrowUp size={13} aria-hidden="true" /> : <ArrowDown size={13} aria-hidden="true" />)}</button></th>
                  <th>Teléfono</th>
                  <th className="clientes-list-address-column"><button type="button" className="clientes-list-sort-button" onClick={() => toggleSort("address")}>Dirección {sort?.column === "address" && (sort.direction === "asc" ? <ArrowUp size={13} aria-hidden="true" /> : <ArrowDown size={13} aria-hidden="true" />)}</button></th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sortedClientes.map((cliente) => (
                  <tr key={cliente.id}>
                    <td>{cliente.identificacion}</td>
                    <td className="clientes-list-name-column">
                      <span title={[
                        cliente.primerNombre,
                        cliente.segundoNombre,
                        cliente.primerApellido,
                        cliente.segundoApellido,
                      ]
                        .filter(Boolean)
                        .join(" ")}>{clienteNombre(cliente)}</span>
                    </td>
                    <td>{cliente.telefono1}</td>
                    <td className="clientes-list-address-column"><span title={cliente.direccion ?? undefined}>{cliente.direccion || "—"}</span></td>
                    <td>
                      <span
                        className={`status-badge ${cliente.activo ? "active" : "inactive"}`}
                      >
                        {cliente.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>
                      <Link
                        className="table-action"
                        to={`/clientes/${cliente.id}/editar`}
                        aria-label={`Editar cliente ${cliente.identificacion}`}
                      >
                        <Pencil size={15} />
                      </Link>
                      <button
                        className="table-action"
                        type="button"
                        onClick={() => { setDetailImageUrl(null); setSelectedClient(cliente); }}
                        title="Ver cliente"
                        aria-label="Ver cliente"
                      >
                        <Eye size={15} />
                      </button>
                      {isAdmin && (
                        <button
                          className="table-action"
                          onClick={() => void toggle(cliente)}
                          aria-label={`${cliente.activo ? "Inactivar" : "Activar"} cliente ${cliente.identificacion}`}
                        >
                          <Power size={15} />
                        </button>
                      )}
                      <button
                        className="table-action"
                        onClick={() => void downloadSheet(cliente)}
                        title="Descargar ficha del cliente"
                        aria-label="Descargar ficha del cliente"
                      >
                        <Download size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="cliente-pagination">
            <span>
              Mostrando página {page.pagina} de {page.totalPaginas} (
              {page.total} clientes)
            </span>
            <button
              className="table-action"
              disabled={pagina <= 1}
              onClick={() => setPagina((value) => value - 1)}
              aria-label="Página anterior"
            >
              <ChevronLeft size={17} />
            </button>
            <button
              className="table-action"
              disabled={pagina >= page.totalPaginas}
              onClick={() => setPagina((value) => value + 1)}
              aria-label="Página siguiente"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </>
      )}
      {selectedClient && (
        <ClienteDetailModal
          cliente={selectedClient}
          imageUrl={detailImageUrl}
          onClose={() => setSelectedClient(null)}
          onNewLoan={() => {
            const clienteActual = selectedClient;
            setSelectedClient(null);
            navigate("/prestamos/nuevo", { state: { selectedClient: clienteActual } });
          }}
        />
      )}
    </section>
  );
}
