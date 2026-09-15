import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CircleAlert,
  Download,
  Eye,
  HandCoins,
  Pencil,
  MoreHorizontal,
  Printer,
  RefreshCw,
  X,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { formatCRC } from "@/shared/utils/currency";
import {
  abrirPlanPagoPdf,
  descargarPrestamosExcel,
  listarPrestamos,
  obtenerPrestamo,
  resumirPrestamos,
} from "../application/prestamos.use-cases";
import { obtenerResumenDelPrestamo } from "../application/pagos.use-cases";
import { prestamoErrorMessage } from "../domain/prestamo.error";
import type { PagoResumen } from "../domain/pago.types";
import type {
  IndicadorCobranza,
  Prestamo,
  PrestamoFilters,
  PrestamoPage,
  PrestamoSortDirection,
  PrestamoSortField,
  PrestamosResumen,
} from "../domain/prestamo.types";
import { AxiosPagoRepository } from "../infrastructure/axios-pago.repository";
import { AxiosPrestamoRepository } from "../infrastructure/axios-prestamo.repository";
import { Pagination } from "@/shared/components/Pagination";
import "./prestamos-list.css";

const repository = new AxiosPrestamoRepository();
const pagoRepository = new AxiosPagoRepository();
const limitOptions = [10, 25, 50, 100];

function displayDate(value: string | null | undefined) {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}
function cobranzaLabel(value: IndicadorCobranza | null | undefined) {
  return !value ? "—" : value === "AL_DIA" ? "AL DÍA" : value.replace("_", " ");
}
function cobranzaClass(value: IndicadorCobranza | null | undefined) {
  return value ? `cobranza-badge cobranza-${value.toLowerCase()}` : "cobranza-badge";
}
function visualBalance(value: number) {
  return Math.max(0, value);
}
function DetailItem({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`prestamo-detail-item ${className}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function PrestamoDetailModal({
  prestamoId,
  onClose,
}: {
  prestamoId: number;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [prestamo, setPrestamo] = useState<Prestamo | null>(null);
  const [summary, setSummary] = useState<PagoResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([
      obtenerPrestamo(repository, prestamoId),
      obtenerResumenDelPrestamo(pagoRepository, prestamoId),
    ])
      .then(([loan, paymentSummary]) => {
        if (active) {
          setPrestamo(loan);
          setSummary(paymentSummary);
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(prestamoErrorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [prestamoId]);
  return (
    <div
      className="prestamo-detail-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="prestamo-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prestamo-detail-title"
      >
        <div className="prestamo-detail-header">
          <div>
            <p className="eyebrow">DETALLE DEL PRÉSTAMO</p>
            <h2 id="prestamo-detail-title">Préstamo #{prestamoId}</h2>
          </div>
          <button
            className="table-action"
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle del préstamo"
          >
            <X size={18} />
          </button>
        </div>
        {loading && (
          <div className="prestamo-modal-state">
            Cargando detalle y saldo...
          </div>
        )}
        {!loading && error && (
          <div
            className="prestamo-modal-state prestamo-modal-error"
            role="alert"
          >
            {error}
          </div>
        )}
        {!loading && !error && prestamo && summary && (
          <>
            <div className="prestamo-detail-grid">
              <DetailItem label="Nº" value={`#${prestamo.id}`} />
              <DetailItem
                label="Cliente"
                value={prestamo.cliente.nombreCompleto}
              />
              <DetailItem
                label="Identificación"
                value={prestamo.cliente.identificacion}
              />
              <DetailItem
                label="Fecha de alta"
                value={displayDate(prestamo.fechaAlta)}
              />
              <DetailItem
                label="Fecha límite"
                value={displayDate(prestamo.fechaLimiteContractual)}
              />
              <DetailItem label="Estado" value={prestamo.estado} />
              <DetailItem
                label="Situación"
                value={cobranzaLabel(prestamo.indicadorCobranza)}
              />
              <DetailItem
                className="prestamo-detail-wide"
                label="Saldo pendiente"
                value={formatCRC(visualBalance(summary.saldoPendiente))}
              />
            </div>
            <div className="prestamo-detail-extra">
              <DetailItem label="Capital" value={formatCRC(prestamo.capital)} />
              <DetailItem label="Interés" value={formatCRC(prestamo.interes)} />
            </div>
          </>
        )}
        <div className="prestamo-detail-actions">
          {prestamo && prestamo.estado !== "CANCELADO" && prestamo.estado !== "ANULADO" && (
            <button className="primary-button" type="button" onClick={() => { onClose(); navigate(`/prestamos/${prestamo.id}/editar`); }}>
              <Pencil size={15} /> Editar préstamo
            </button>
          )}
          <button className="secondary-button" type="button" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export function PrestamosListPage() {
  const location = useLocation();
  const [page, setPage] = useState<PrestamoPage | null>(null);
  const [summary, setSummary] = useState<PrestamosResumen | null>(null);
  const [buscar, setBuscar] = useState("");
  const [debouncedBuscar, setDebouncedBuscar] = useState("");
  const [direccion, setDireccion] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [ordenarPor, setOrdenarPor] = useState<PrestamoSortField | undefined>();
  const [direccionOrden, setDireccionOrden] = useState<
    PrestamoSortDirection | undefined
  >();
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(10);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [openActionMenu, setOpenActionMenu] = useState<number | null>(null);
  useEffect(() => {
    const state = location.state;
    if (state && typeof state === "object" && "prestamoId" in state && typeof state.prestamoId === "number" && Number.isInteger(state.prestamoId) && state.prestamoId > 0) setSelected(state.prestamoId);
  }, [location.state]);
  const listRequestId = useRef(0);
  const summaryRequestId = useRef(0);
  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedBuscar(buscar.trim().replace(/\s+/g, " ")),
      300,
    );
    return () => window.clearTimeout(timeout);
  }, [buscar]);
  useEffect(() => {
    setPagina(1);
  }, [debouncedBuscar]);
  const dateValidation =
    fechaInicio && fechaFin && fechaInicio > fechaFin
      ? "La fecha de inicio no puede ser posterior a la fecha de fin."
      : "";
  const buildFilterValues = useCallback((): Omit<
    PrestamoFilters,
    "pagina" | "limite"
  > => {
    const filters: Omit<PrestamoFilters, "pagina" | "limite"> = {
      estados: ["ACTIVO"],
    };
    if (debouncedBuscar.trim()) filters.buscar = debouncedBuscar.trim();
    if (direccion.trim()) filters.direccion = direccion.trim();
    if (fechaInicio) filters.fechaInicio = fechaInicio;
    if (fechaFin) filters.fechaFin = fechaFin;
    return filters;
  }, [debouncedBuscar, direccion, fechaFin, fechaInicio]);
  const loadList = useCallback(async () => {
    const requestId = ++listRequestId.current;
    if (dateValidation) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await listarPrestamos(repository, {
        ...buildFilterValues(),
        ordenarPor,
        direccionOrden,
        pagina,
        limite,
      });
      if (requestId !== listRequestId.current) return;
      const totalPages = Math.max(0, result.totalPaginas);
      const safePage =
        totalPages === 0 ? 1 : Math.min(Math.max(1, result.pagina), totalPages);
      if (safePage !== pagina) setPagina(safePage);
      setPage({ ...result, pagina: safePage });
      setError("");
    } catch (cause: unknown) {
      if (requestId === listRequestId.current)
        setError(prestamoErrorMessage(cause));
    } finally {
      if (requestId === listRequestId.current) setLoading(false);
    }
  }, [
    buildFilterValues,
    dateValidation,
    direccionOrden,
    limite,
    ordenarPor,
    pagina,
  ]);
  const loadSummary = useCallback(async () => {
    const requestId = ++summaryRequestId.current;
    if (dateValidation) {
      setSummaryLoading(false);
      return;
    }
    setSummaryLoading(true);
    setSummaryError("");
    try {
      const result = await resumirPrestamos(repository, {
        ...buildFilterValues(),
        pagina: 1,
        limite: 10,
      });
      if (requestId === summaryRequestId.current) setSummary(result);
    } catch {
      if (requestId === summaryRequestId.current)
        setSummaryError("No se pudo cargar el resumen financiero.");
    } finally {
      if (requestId === summaryRequestId.current) setSummaryLoading(false);
    }
  }, [buildFilterValues, dateValidation]);
  useEffect(() => {
    void loadList();
  }, [loadList]);
  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);
  useEffect(() => {
    if (openActionMenu === null) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".prestamos-list-row-menu")) return;
      setOpenActionMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenActionMenu(null);
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openActionMenu]);
  const datosFiltrados = page?.datos ?? [];
  const reload = () => {
    void loadList();
    void loadSummary();
  };
  const total = page?.total ?? 0;
  const totalPages = page?.totalPaginas ?? 0;
  const actionNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  };
  const exportar = async () => {
    if (exportLoading) return;
    setExportLoading(true);
    try {
      await descargarPrestamosExcel(repository, {
        buscar: buscar.trim() || undefined,
        direccion: direccion.trim() || undefined,
         estados: ["ACTIVO"],
        fechaInicio: fechaInicio || undefined,
        fechaFin: fechaFin || undefined,
      });
    } catch {
      setError("No se pudo generar el archivo Excel.");
    } finally {
      setExportLoading(false);
    }
  };
  const sortColumn = (column: PrestamoSortField) => {
    if (ordenarPor !== column) {
      setOrdenarPor(column);
      setDireccionOrden("ASC");
    } else {
      setDireccionOrden((current) => (current === "ASC" ? "DESC" : "ASC"));
    }
    setPagina(1);
  };
  const sortIcon = (column: PrestamoSortField) =>
    ordenarPor !== column ? (
      <ArrowUpDown size={14} aria-hidden="true" />
    ) : direccionOrden === "ASC" ? (
      <ArrowUp size={14} aria-hidden="true" />
    ) : (
      <ArrowDown size={14} aria-hidden="true" />
    );
  return (
    <section className="prestamos-list-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">GESTIÓN</p>
          <h1>Gestión de préstamos activos</h1>
          <p className="muted">Préstamos en gestión normal de cobro.</p>
        </div>
        <div className="prestamos-list-header-actions">
          <Link className="primary-button" to="/prestamos/nuevo">
            Nuevo préstamo
          </Link>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void exportar()}
            disabled={exportLoading}
          >
            <Download size={16} />
            {exportLoading ? "Generando Excel..." : "Descargar Excel"}
          </button>
        </div>
      </div>
      <div className="panel prestamos-list-filters">
        <label>
          Cliente
          <input
            value={buscar}
            placeholder="Nombre completo, identificación, teléfono o dirección"
            onChange={(event) => {
              setBuscar(event.target.value);
              setPagina(1);
            }}
          />
        </label>
        <label>
          Dirección
          <input
            value={direccion}
            placeholder="Dirección"
            onChange={(event) => {
              setDireccion(event.target.value);
              setPagina(1);
            }}
          />
        </label>
        <label>
          Fecha inicio
          <input
            type="date"
            value={fechaInicio}
            onChange={(event) => {
              setFechaInicio(event.target.value);
              setPagina(1);
            }}
          />
        </label>
        <label>
          Fecha fin
          <input
            type="date"
            value={fechaFin}
            onChange={(event) => {
              setFechaFin(event.target.value);
              setPagina(1);
            }}
          />
        </label>
      </div>
      {dateValidation && (
        <p className="prestamos-list-validation" role="status">
          {dateValidation}
        </p>
      )}
      <div
        className="prestamos-financial-summary"
        aria-label="Resumen financiero"
      >
        <div>
          <span>TOTAL</span>
          <strong>
            {summary ? summary.total.toLocaleString("es-CR") : "—"}
          </strong>
        </div>
        <div>
          <span>PRESTADO</span>
          <strong>{summary ? formatCRC(summary.prestado) : "—"}</strong>
        </div>
        <div>
          <span>GANANCIA</span>
          <strong>{summary ? formatCRC(summary.ganancia) : "—"}</strong>
        </div>
        <div>
          <span>RECUPERADO</span>
          <strong>{summary ? formatCRC(summary.recuperado) : "—"}</strong>
        </div>
        <div>
          <span>PENDIENTE</span>
          <strong>{summary ? formatCRC(summary.pendiente) : "—"}</strong>
        </div>
        {summaryLoading && <small aria-live="polite">Cargando...</small>}
        {summaryError && (
          <small className="prestamos-financial-summary-error" role="alert">
            {summaryError}
          </small>
        )}
      </div>
      {notice && (
        <p className="prestamos-list-notice" role="status">
          <CircleAlert size={15} />
          {notice}
        </p>
      )}
      {error && (
        <div className="panel prestamos-list-state" role="alert">
          <p>{error}</p>
          <button className="secondary-button" type="button" onClick={reload}>
            <RefreshCw size={14} /> Reintentar
          </button>
        </div>
      )}
      {loading && datosFiltrados.length > 0 && (
        <p className="prestamos-list-loading" role="status">
          Actualizando préstamos...
        </p>
      )}
      {!error && loading && !datosFiltrados.length && (
        <div className="panel prestamos-list-state">Cargando...</div>
      )}
      {!error &&
        !loading &&
        datosFiltrados.length === 0 && (
          <div className="panel prestamos-list-state">
            No se encontraron préstamos.
          </div>
        )}
      {datosFiltrados.length > 0 && (
        <div className="panel table-wrap prestamos-list-table-wrap">
          <table className="prestamos-list-table">
            <colgroup>
              <col className="prestamos-list-col-number" />
              <col className="prestamos-list-col-client" />
              <col className="prestamos-list-col-address" />
              <col className="prestamos-list-col-date" />
              <col className="prestamos-list-col-capital" />
              <col className="prestamos-list-col-balance" />
              <col className="prestamos-list-col-status" />
              <col className="prestamos-list-col-cobranza" />
              <col className="prestamos-list-col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th>
                  <button
                    type="button"
                    className="prestamos-list-sort-button"
                    onClick={() => sortColumn("id")}
                    aria-sort={
                      ordenarPor === "id"
                        ? direccionOrden === "ASC"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    Nº {sortIcon("id")}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className="prestamos-list-sort-button"
                    onClick={() => sortColumn("cliente")}
                    aria-sort={
                      ordenarPor === "cliente"
                        ? direccionOrden === "ASC"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    Cliente {sortIcon("cliente")}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className="prestamos-list-sort-button"
                    onClick={() => sortColumn("direccion")}
                    aria-sort={
                      ordenarPor === "direccion"
                        ? direccionOrden === "ASC"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    Dirección {sortIcon("direccion")}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className="prestamos-list-sort-button"
                    onClick={() => sortColumn("fechaAlta")}
                    aria-sort={
                      ordenarPor === "fechaAlta"
                        ? direccionOrden === "ASC"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    Alta {sortIcon("fechaAlta")}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className="prestamos-list-sort-button"
                    onClick={() => sortColumn("capital")}
                    aria-sort={
                      ordenarPor === "capital"
                        ? direccionOrden === "ASC"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    Capital {sortIcon("capital")}
                  </button>
                </th>
                 <th>
                   <button type="button" className="prestamos-list-sort-button" onClick={() => sortColumn("saldoPendiente")} aria-sort={ordenarPor === "saldoPendiente" ? direccionOrden === "ASC" ? "ascending" : "descending" : "none"}>
                      Saldo {sortIcon("saldoPendiente")}
                   </button>
                 </th>
                <th>
                  <button
                    type="button"
                    className="prestamos-list-sort-button"
                    onClick={() => sortColumn("estado")}
                    aria-sort={
                      ordenarPor === "estado"
                        ? direccionOrden === "ASC"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    Estado {sortIcon("estado")}
                  </button>
                </th>
                 <th>
                   <button type="button" className="prestamos-list-sort-button" onClick={() => sortColumn("indicadorCobranza")} aria-sort={ordenarPor === "indicadorCobranza" ? direccionOrden === "ASC" ? "ascending" : "descending" : "none"}>
                     Cobranza {sortIcon("indicadorCobranza")}
                   </button>
                 </th>
              </tr>
            </thead>
            <tbody>
               {datosFiltrados.map((prestamo) => {
                 return <tr key={prestamo.id}>
                  <td>#{prestamo.id}</td>
                  <td>
                    <strong>{prestamo.cliente.nombreCompleto}</strong>
                  </td>
                  <td>
                    <span className="prestamos-list-address">
                      {prestamo.cliente.direccion || "—"}
                    </span>
                  </td>
                  <td>{displayDate(prestamo.fechaAlta)}</td>
                  <td>{formatCRC(prestamo.capital)}</td>
                  <td>{formatCRC(prestamo.saldoPendiente)}</td>
                  <td>
                    <span className={`status-badge prestamo-status-${prestamo.estado.toLowerCase()}`}>{prestamo.estado}</span>
                  </td>
                  <td>
                    <span className={cobranzaClass(prestamo.indicadorCobranza)}>
                      {cobranzaLabel(prestamo.indicadorCobranza)}
                    </span>
                  </td>
                  <td>
                    <div className="prestamos-list-actions">
                      <div className="prestamos-list-row-menu">
                          <button
                            className="table-action"
                           type="button"
                           title="Más acciones"
                           aria-label="Más acciones"
                           aria-haspopup="menu"
                           aria-expanded={openActionMenu === prestamo.id}
                            onClick={() => setOpenActionMenu((current) => current === prestamo.id ? null : prestamo.id)}
                          >
                            <MoreHorizontal size={16} />
                          </button>
                           {openActionMenu === prestamo.id && <div className="prestamos-list-row-menu-content" role="menu">
                             <button type="button" role="menuitem" onClick={() => { setSelected(prestamo.id); setOpenActionMenu(null); }}><Eye size={15} /> Ver préstamo</button>
                             {prestamo.estado !== "CANCELADO" && prestamo.estado !== "ANULADO" && <Link role="menuitem" to={`/prestamos/${prestamo.id}/editar`} onClick={() => setOpenActionMenu(null)}><Pencil size={15} /> Editar préstamo</Link>}
                           </div>}
                      </div>
                       {prestamo.estado === "ACTIVO" && <Link className="table-action" title="Registrar pago" to="/pagos/registrar" state={{ prestamoId: prestamo.id }}>
                        <HandCoins size={16} />
                      </Link>}
                      {prestamo.estado === "ACTIVO" && (
                        <Link
                          className="table-action"
                          title="Refinanciar préstamo"
                          aria-label="Refinanciar préstamo"
                          to="/refinanciamientos/nuevo"
                          state={{ prestamoId: prestamo.id }}
                        >
                          <RefreshCw size={16} />
                        </Link>
                      )}
                      <button
                        className="table-action"
                        type="button"
                        title="Imprimir plan"
                        onClick={() =>
                          void abrirPlanPagoPdf(repository, prestamo.id).catch(
                            (cause) =>
                              actionNotice(prestamoErrorMessage(cause)),
                          )
                        }
                      >
                        <Printer size={16} />
                      </button>
                    </div>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        pagina={pagina}
        totalPaginas={totalPages}
        total={total}
        limite={limite}
        opcionesLimite={limitOptions}
        onPageChange={setPagina}
        onLimitChange={(value) => {
          setLimite(value);
          setPagina(1);
        }}
        label="préstamos"
        disabled={loading}
      />
      {selected && (
        <PrestamoDetailModal
          prestamoId={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
