import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  CircleAlert,
  Download,
  Eye,
  HandCoins,
  Pencil,
  MoreHorizontal,
  Printer,
  RotateCcw,
  RefreshCw,
  X,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { useAuth } from "@/app/providers/auth-context";
import { formatCRC } from "@/shared/utils/currency";
import {
  abrirPlanPagoPdf,
  cambiarEstadoPrestamo,
  descargarPrestamosExcel,
  listarPrestamos,
  obtenerPrestamo,
  resumirPrestamos,
  anularPrestamo,
} from "../application/prestamos.use-cases";
import { obtenerResumenDelPrestamo } from "../application/pagos.use-cases";
import { prestamoErrorMessage } from "../domain/prestamo.error";
import type { PagoResumen } from "../domain/pago.types";
import type {
  EstadoPrestamo,
  IndicadorCobranza,
  Prestamo,
  PrestamoFilters,
  PrestamoPage,
  PrestamoSortDirection,
  PrestamoSortField,
  PrestamosResumen,
} from "../domain/prestamo.types";
import type { AnularPrestamoInput, CambiarEstadoPrestamoInput } from "../domain/prestamo.types";
import { AxiosPagoRepository } from "../infrastructure/axios-pago.repository";
import { AxiosPrestamoRepository } from "../infrastructure/axios-prestamo.repository";
import { Pagination } from "@/shared/components/Pagination";
import "./prestamos-list.css";

const repository = new AxiosPrestamoRepository();
const pagoRepository = new AxiosPagoRepository();
const limitOptions = [10, 25, 50, 100];
const estados: Array<{ value: EstadoPrestamo; label: string }> = [
  { value: "ACTIVO", label: "ACTIVO" },
  { value: "REFINANCIADO", label: "REFINANCIADO" },
  { value: "CANCELADO", label: "CANCELADO" },
  { value: "INCOBRABLE", label: "INCOBRABLE" },
  { value: "ANULADO", label: "ANULADO" },
];

function localDateValue() {
  const today = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
}

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

function AnularPrestamoModal({ prestamo, onClose, onSuccess }: { prestamo: Prestamo; onClose: () => void; onSuccess: () => Promise<void> }) {
  const [fecha, setFecha] = useState(localDateValue);
  const [observacion, setObservacion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [busy, onClose]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !fecha) return;
    setBusy(true);
    setError("");
    const input: AnularPrestamoInput = { fecha, ...(observacion.trim() ? { observacion: observacion.trim() } : {}) };
    try {
      await anularPrestamo(repository, prestamo.id, input);
      await onSuccess();
      onClose();
      await Swal.fire({ toast: true, position: "top-end", icon: "success", title: "Préstamo anulado correctamente.", showConfirmButton: false, timer: 2200, timerProgressBar: true });
    } catch (cause) {
      setError(prestamoErrorMessage(cause));
      setBusy(false);
    }
  };

  return <div className="prestamo-cancellation-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className="prestamo-cancellation-modal" role="dialog" aria-modal="true" aria-labelledby="prestamo-cancellation-title">
      <div className="prestamo-detail-header"><div><p className="eyebrow">ACCIÓN ADMINISTRATIVA</p><h2 id="prestamo-cancellation-title">Anular préstamo</h2></div><button className="table-action" type="button" onClick={onClose} aria-label="Cerrar" disabled={busy}><X size={18} /></button></div>
      <p className="prestamo-cancellation-text">Esta acción anulará el préstamo y generará el reverso correspondiente en Caja. El registro se conservará para fines históricos.</p>
      <div className="prestamo-cancellation-summary"><DetailItem label="Nº" value={`#${prestamo.id}`} /><DetailItem label="Cliente" value={prestamo.cliente.nombreCompleto} /><DetailItem label="Capital" value={formatCRC(prestamo.capital)} /><DetailItem label="Monto desembolsado" value={formatCRC(prestamo.montoDesembolsado)} /><DetailItem label="Estado" value={prestamo.estado} /></div>
      <form onSubmit={(event) => void submit(event)}>
        <label className="prestamo-cancellation-field">Fecha *<input ref={firstFieldRef} type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} required disabled={busy} /></label>
        <label className="prestamo-cancellation-field">Motivo / observación<textarea rows={3} value={observacion} onChange={(event) => setObservacion(event.target.value)} disabled={busy} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="prestamo-detail-actions"><button className="secondary-button" type="button" onClick={onClose} disabled={busy}>Cancelar</button><button className="primary-button" type="submit" disabled={busy || !fecha}><Ban size={15} />{busy ? "Anulando..." : "Anular préstamo"}</button></div>
      </form>
    </div>
  </div>;
}

function ReactivarPrestamoModal({ prestamo, onClose, onSuccess }: { prestamo: Prestamo; onClose: () => void; onSuccess: () => Promise<void> }) {
  const [fecha, setFecha] = useState(localDateValue());
  const [observacion, setObservacion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const firstFieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [busy, onClose]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    if (!fecha || !observacion.trim()) { setError("La fecha y la observación son obligatorias."); setBusy(false); return; }
    const input: CambiarEstadoPrestamoInput = { estado: "ACTIVO", fecha, observacion: observacion.trim() };
    try {
      await cambiarEstadoPrestamo(repository, prestamo.id, input);
      await onSuccess();
      onClose();
      await Swal.fire({ toast: true, position: "top-end", icon: "success", title: "Préstamo reactivado correctamente.", showConfirmButton: false, timer: 2200, timerProgressBar: true });
    } catch (cause) {
      setError(prestamoErrorMessage(cause));
      setBusy(false);
    }
  };

  return <div className="prestamo-cancellation-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className="prestamo-cancellation-modal" role="dialog" aria-modal="true" aria-labelledby="prestamo-reactivation-title" aria-describedby="prestamo-reactivation-description" aria-busy={busy}>
      <div className="prestamo-detail-header"><div><p className="eyebrow">ACCIÓN ADMINISTRATIVA</p><h2 id="prestamo-reactivation-title">Reactivar préstamo</h2></div><button className="table-action" type="button" onClick={onClose} aria-label="Cerrar" disabled={busy}><X size={18} /></button></div>
      <p className="prestamo-cancellation-text" id="prestamo-reactivation-description">El préstamo volverá al estado ACTIVO y podrá continuar con su gestión normal de cobro.</p>
      <div className="prestamo-cancellation-summary"><DetailItem label="Nº" value={`#${prestamo.id}`} /><DetailItem label="Cliente" value={prestamo.cliente.nombreCompleto} /><DetailItem label="Estado actual" value="INCOBRABLE" /><DetailItem label="Nuevo estado" value="ACTIVO" /></div>
      <ul className="prestamo-status-action-notes"><li>No registra ningún pago.</li><li>No genera movimientos de Caja.</li><li>No modifica pagos históricos.</li><li>No modifica automáticamente el plan.</li></ul>
      <form onSubmit={(event) => void submit(event)}>
        <label className="prestamo-cancellation-field">Fecha *<input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} required disabled={busy} /></label>
        <label className="prestamo-cancellation-field">Observación *<textarea ref={firstFieldRef} rows={3} maxLength={500} value={observacion} onChange={(event) => setObservacion(event.target.value)} required disabled={busy} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="prestamo-detail-actions"><button className="secondary-button" type="button" onClick={onClose} disabled={busy}>Cancelar</button><button className="primary-button" type="submit" disabled={busy || !fecha || !observacion.trim()}><RotateCcw size={15} />{busy ? "Reactivando..." : "Reactivar préstamo"}</button></div>
      </form>
    </div>
  </div>;
}

function PrestamoDetailModal({
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
  const { user } = useAuth();
  const isAdmin = user?.rol === "ADMINISTRADOR";
  const [page, setPage] = useState<PrestamoPage | null>(null);
  const [summary, setSummary] = useState<PrestamosResumen | null>(null);
  const [buscar, setBuscar] = useState("");
  const [debouncedBuscar, setDebouncedBuscar] = useState("");
  const [direccion, setDireccion] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [selectedEstados, setSelectedEstados] = useState<EstadoPrestamo[]>([
    "ACTIVO",
  ]);
  const [ordenarPor, setOrdenarPor] = useState<PrestamoSortField | undefined>();
  const [direccionOrden, setDireccionOrden] = useState<
    PrestamoSortDirection | undefined
  >();
  const [estadoDropdownOpen, setEstadoDropdownOpen] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(10);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [cancellationTarget, setCancellationTarget] = useState<Prestamo | null>(null);
  const [reactivationTarget, setReactivationTarget] = useState<Prestamo | null>(null);
  const [openActionMenu, setOpenActionMenu] = useState<number | null>(null);
  const estadoDropdownRef = useRef<HTMLDivElement>(null);
  const listRequestId = useRef(0);
  const summaryRequestId = useRef(0);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedBuscar(buscar), 350);
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
      estados: selectedEstados,
    };
    if (debouncedBuscar.trim()) filters.buscar = debouncedBuscar.trim();
    if (direccion.trim()) filters.direccion = direccion.trim();
    if (fechaInicio) filters.fechaInicio = fechaInicio;
    if (fechaFin) filters.fechaFin = fechaFin;
    return filters;
  }, [debouncedBuscar, direccion, fechaFin, fechaInicio, selectedEstados]);
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
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        estadoDropdownRef.current &&
        !estadoDropdownRef.current.contains(event.target as Node)
      )
        setEstadoDropdownOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);
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
  const estadoSummary = selectedEstados.length
    ? selectedEstados.join(", ")
    : "Seleccione estados";
  const toggleEstado = (estado: EstadoPrestamo) => {
    setSelectedEstados((current) =>
      current.includes(estado)
        ? current.filter((value) => value !== estado)
        : [...current, estado],
    );
    setPagina(1);
  };
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
        estados: selectedEstados,
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
          <h1>Gestión de préstamos</h1>
          <p className="muted">Consulta y administración de préstamos.</p>
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
          Nombre o identificación
          <input
            value={buscar}
            placeholder="Nombre o identificación"
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
        <div className="prestamos-list-status-filter" ref={estadoDropdownRef}>
          <span className="prestamos-list-filter-label">Estado</span>
          <button
            className="prestamos-list-status-trigger"
            type="button"
            aria-expanded={estadoDropdownOpen}
            onClick={() => setEstadoDropdownOpen((open) => !open)}
          >
            {estadoSummary}
          </button>
          {estadoDropdownOpen && (
            <div className="prestamos-list-status-dropdown">
              <div className="prestamos-list-status-options">
                {estados.map((item) => (
                  <label key={item.value}>
                    <input
                      type="checkbox"
                      checked={selectedEstados.includes(item.value)}
                      onChange={() => toggleEstado(item.value)}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
              <div className="prestamos-list-status-actions">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEstados(estados.map((item) => item.value));
                    setPagina(1);
                  }}
                >
                  Seleccionar todos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEstados([]);
                    setPagina(1);
                  }}
                >
                  Limpiar
                </button>
              </div>
            </div>
          )}
        </div>
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
      {!error && !loading && selectedEstados.length === 0 && (
        <div className="panel prestamos-list-state">
          Seleccione al menos un estado
        </div>
      )}
      {!error &&
        !loading &&
        selectedEstados.length > 0 &&
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
                const puedeReactivar = isAdmin && prestamo.estado === "INCOBRABLE";
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
                             {isAdmin && prestamo.estado === "ACTIVO" && prestamo.puedeAnular === true && <button type="button" role="menuitem" onClick={() => { setCancellationTarget(prestamo); setOpenActionMenu(null); }}><Ban size={15} /> Anular préstamo</button>}
                             {puedeReactivar && <button type="button" role="menuitem" onClick={() => { setReactivationTarget(prestamo); setOpenActionMenu(null); }}><RotateCcw size={15} /> Reactivar préstamo</button>}
                          </div>}
                      </div>
                      {prestamo.estado !== "ANULADO" && <Link className="table-action" title="Registrar pago" to="/pagos/registrar" state={{ prestamoId: prestamo.id }}>
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
      {cancellationTarget && <AnularPrestamoModal prestamo={cancellationTarget} onClose={() => setCancellationTarget(null)} onSuccess={async () => { await Promise.all([loadList(), loadSummary()]); }} />}
      {reactivationTarget && <ReactivarPrestamoModal prestamo={reactivationTarget} onClose={() => setReactivationTarget(null)} onSuccess={async () => { await Promise.all([loadList(), loadSummary()]); }} />}
    </section>
  );
}
