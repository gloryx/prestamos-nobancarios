import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Printer, Search, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/auth-context";
import { CurrencyInput } from "@/shared/components/forms/CurrencyInput";
import { formatCRC } from "@/shared/utils/currency";
import { Pagination } from "@/shared/components/Pagination";
import { listFormasPago } from "@/features/formas-pago/application/formas-pago.use-cases";
import { AxiosFormaPagoRepository } from "@/features/formas-pago/infrastructure/axios-forma-pago.repository";
import { listPeriodicidades } from "@/features/periodicidades-pago/application/periodicidades-pago.use-cases";
import { AxiosPeriodicidadRepository } from "@/features/periodicidades-pago/infrastructure/axios-periodicidad.repository";
import {
  abrirEstadoCuentaPdf,
  obtenerPrestamo,
} from "@/features/prestamos/application/prestamos.use-cases";
import { AxiosPrestamoRepository } from "@/features/prestamos/infrastructure/axios-prestamo.repository";
import { AxiosRefinanciamientoRepository } from "../infrastructure/axios-refinanciamiento.repository";
import {
  crearRefinanciamiento,
  listarPrestamosActivosParaRefinanciar,
  previsualizarRefinanciamiento,
  refinanciamientoErrorMessage,
} from "../application/refinanciamientos.use-cases";
import type {
  CrearRefinanciamientoInput,
  RefinanciamientoPreview,
  RefinanciamientoResponse,
} from "../domain/refinanciamiento.types";
import type { FormaPago } from "@/features/formas-pago/domain/forma-pago.types";
import type { Periodicidad } from "@/features/periodicidades-pago/domain/periodicidad-pago.types";
import type {
  Prestamo,
  PrestamoPage,
} from "@/features/prestamos/domain/prestamo.types";
import "./nuevo-refinanciamiento.css";

const loanRepository = new AxiosPrestamoRepository();
const refRepository = new AxiosRefinanciamientoRepository();
const paymentRepository = new AxiosFormaPagoRepository();
const periodRepository = new AxiosPeriodicidadRepository();
const money = (value: number | undefined) => formatCRC(Number(value ?? 0));
const today = () => new Date().toISOString().slice(0, 10);
const dateLabel = (value: string) =>
  value ? value.slice(0, 10).split("-").reverse().join("/") : "—";

function LoanModal({
  onSelect,
  onClose,
}: {
  onSelect: (loan: Prestamo) => void;
  onClose: () => void;
}) {
  const [page, setPage] = useState<PrestamoPage | null>(null);
  const [search, setSearch] = useState("");
  const [pagina, setPagina] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const next = await listarPrestamosActivosParaRefinanciar(
        loanRepository,
        pagina,
        search,
      );
      if (id === requestId.current) setPage(next);
    } catch (cause) {
      if (id === requestId.current)
        setError(refinanciamientoErrorMessage(cause));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [pagina, search]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 300);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    const focusables = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          ".refinancing-modal input, .refinancing-modal button, .refinancing-modal select",
        ),
      ).filter((item) => !item.hasAttribute("disabled"));
    const first = focusables()[0];
    first?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const items = focusables();
        if (!items.length) return;
        const index = items.indexOf(document.activeElement as HTMLElement);
        if (event.shiftKey && index <= 0) {
          event.preventDefault();
          items[items.length - 1].focus();
        } else if (!event.shiftKey && index === items.length - 1) {
          event.preventDefault();
          items[0].focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div className="refinancing-backdrop">
      <section
        className="refinancing-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="loan-modal-title"
      >
        <header>
          <h2 id="loan-modal-title">Seleccionar préstamo activo</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <label htmlFor="loan-search">
          Buscar por cliente o identificación
          <input
            id="loan-search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPagina(1);
            }}
          />
        </label>
        {loading && <p role="status">Cargando préstamos...</p>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && !page?.datos.length && (
          <p role="status">No se encontraron préstamos activos.</p>
        )}
        {!loading && !error && page?.datos.length ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Préstamo</th>
                    <th>Cliente</th>
                    <th>Identificación</th>
                    <th>Capital pendiente</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {page.datos.map((loan) => (
                    <tr key={loan.id}>
                      <td>#{loan.id}</td>
                      <td>{loan.cliente.nombreCompleto}</td>
                      <td>{loan.cliente.identificacion}</td>
                      <td>{money(loan.capitalPendiente ?? loan.capital)}</td>
                      <td>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => onSelect(loan)}
                        >
                          Seleccionar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              pagina={page.pagina}
              totalPaginas={page.totalPaginas}
              total={page.total}
              limite={page.limite}
              opcionesLimite={[10]}
              onPageChange={setPagina}
              onLimitChange={() => undefined}
              label="préstamos"
              loading={loading}
            />
          </>
        ) : null}
      </section>
    </div>
  );
}

export function NuevoRefinanciamientoPage() {
  const location = useLocation();
  const navigationState = location.state as unknown;
  const navigationPrestamoId =
    typeof navigationState === "object" &&
    navigationState !== null &&
    "prestamoId" in navigationState &&
    typeof navigationState.prestamoId === "number" &&
    Number.isInteger(navigationState.prestamoId) &&
    navigationState.prestamoId > 0
      ? navigationState.prestamoId
      : null;
  const { user } = useAuth();
  const navigate = useNavigate();
  const allowed = user?.rol === "ADMINISTRADOR" || user?.rol === "VENDEDOR";
  const [step, setStep] = useState(1);
  const [loan, setLoan] = useState<Prestamo | null>(null);
  const [preview, setPreview] = useState<RefinanciamientoPreview | null>(null);
  const [modal, setModal] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<RefinanciamientoResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementError, setStatementError] = useState(false);
  const previewRequestId = useRef(0);
  const [formas, setFormas] = useState<FormaPago[]>([]);
  const [periodicidades, setPeriodicidades] = useState<Periodicidad[]>([]);
  const [fecha, setFecha] = useState(today);
  const [monto, setMonto] = useState<number | null>(0);
  const [interes, setInteres] = useState<number | null>(0);
  const [periodicidadId, setPeriodicidadId] = useState("");
  const [formaPagoId, setFormaPagoId] = useState("");
  const [formaDesembolsoId, setFormaDesembolsoId] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [personalizado, setPersonalizado] = useState(false);
  const [observaciones, setObservaciones] = useState("");
  const [cuotas, setCuotas] = useState([
    { numeroPago: 1, fechaVencimiento: today(), montoProgramado: "0" },
  ]);
  useEffect(() => {
    void Promise.all([
      listFormasPago(paymentRepository),
      listPeriodicidades(periodRepository),
    ])
      .then(([nextFormas, nextPeriods]) => {
        setFormas(nextFormas.filter((item) => item.activo));
        setPeriodicidades(nextPeriods.filter((item) => item.activo));
      })
      .catch((cause) => setCatalogError(refinanciamientoErrorMessage(cause)));
  }, []);
  const selectLoan = useCallback(async (selected: Prestamo) => {
    const id = ++previewRequestId.current;
    setModal(false);
    setLoan(selected);
    setPreview(null);
    setError("");
    setStep(1);
    setPreviewLoading(true);
    try {
      const next = await previsualizarRefinanciamiento(
        refRepository,
        selected.id,
      );
      if (id === previewRequestId.current) setPreview(next);
    } catch (cause) {
      if (id === previewRequestId.current)
        setError(refinanciamientoErrorMessage(cause));
    } finally {
      if (id === previewRequestId.current) setPreviewLoading(false);
    }
  }, []);
  useEffect(() => {
    if (navigationPrestamoId === null) return;
    const requestId = ++previewRequestId.current;
    void obtenerPrestamo(loanRepository, navigationPrestamoId)
      .then((selected) => {
        if (requestId === previewRequestId.current) void selectLoan(selected);
      })
      .catch((cause) => {
        if (requestId === previewRequestId.current)
          setError(refinanciamientoErrorMessage(cause));
      });
  }, [navigationPrestamoId, selectLoan]);
  const reset = () => {
    setStep(1);
    setLoan(null);
    setPreview(null);
    setSuccess(null);
    setError("");
    setFecha(today());
    setMonto(0);
    setInteres(0);
    setPeriodicidadId("");
    setFormaPagoId("");
    setFormaDesembolsoId("");
    setCantidad("1");
    setPersonalizado(false);
    setObservaciones("");
    setCuotas([
      { numeroPago: 1, fechaVencimiento: today(), montoProgramado: "0" },
    ]);
  };
  const amount = monto ?? 0;
  const validMoney = (value: number | null) =>
    value !== null && Number.isFinite(value) && value >= 0;
  const validCustomPlan =
    !personalizado ||
    (cuotas.length === Number(cantidad) &&
      cuotas.every(
        (item) =>
          item.fechaVencimiento &&
          Number(item.montoProgramado) > 0 &&
          /^\d+(\.\d{0,2})?$/.test(item.montoProgramado),
      ));
  const canContinue = Boolean(
    loan &&
    preview?.elegible &&
    fecha &&
    validMoney(monto) &&
    validMoney(interes) &&
    amount >= 0 &&
    (amount === 0 || formaDesembolsoId) &&
    periodicidadId &&
    formaPagoId &&
    Number(cantidad) > 0 &&
    validCustomPlan,
  );
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || !canContinue || !preview || !loan) return;
    setSubmitting(true);
    setError("");
    try {
      const input: CrearRefinanciamientoInput = {
        prestamoOrigenId: loan.id,
        periodicidadPagoId: Number(periodicidadId),
        formaPagoId: Number(formaPagoId),
        formaDesembolsoId: amount > 0 ? Number(formaDesembolsoId) : null,
        fecha,
        montoNuevoDesembolsado: amount,
        interesNuevo: interes ?? 0,
        cantidadPagos: Number(cantidad),
        planPersonalizado: personalizado,
        ...(personalizado
          ? {
              cuotas: cuotas.map((item) => ({
                numeroPago: item.numeroPago,
                fechaVencimiento: item.fechaVencimiento,
                montoProgramado: Number(item.montoProgramado),
              })),
            }
          : {}),
        ...(observaciones.trim()
          ? { observaciones: observaciones.trim() }
          : {}),
      };
      setSuccess(await crearRefinanciamiento(refRepository, input));
    } catch (cause) {
      setError(refinanciamientoErrorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };
  const openStatement = async () => {
    if (!success || statementLoading) return;
    setStatementLoading(true);
    setStatementError(false);
    try {
      await abrirEstadoCuentaPdf(loanRepository, success.prestamoNuevoId);
    } catch {
      setStatementError(true);
    } finally {
      setStatementLoading(false);
    }
  };
  const capitalNuevoEstimado =
    (preview?.capitalPendienteRefinanciable ?? 0) + amount;
  const totalNuevoEstimado = capitalNuevoEstimado + (interes ?? 0);
  const formaDesembolsoNombre =
    amount === 0
      ? "No aplica"
      : formas.find((item) => String(item.id) === formaDesembolsoId)?.nombre ||
        "—";
  const formaPagoNombre =
    formas.find((item) => String(item.id) === formaPagoId)?.nombre || "—";
  const periodicidadNombre =
    periodicidades.find((item) => String(item.id) === periodicidadId)?.nombre ||
    "—";
  if (!allowed)
    return (
      <section className="new-refinancing-page">
        <p className="form-error" role="alert">
          No tienes permisos para registrar refinanciamientos.
        </p>
      </section>
    );
  if (success)
    return (
      <section className="new-refinancing-page">
        <div className="page-heading">
          <div>
            <p className="eyebrow">REFINANCIAMIENTOS</p>
            <h1>Nuevo refinanciamiento</h1>
          </div>
        </div>
        <div className="success-panel" role="status">
          <h2>Refinanciamiento registrado correctamente</h2>
          <p>
            El préstamo origen #{success.prestamoOrigenId} quedó REFINANCIADO y
            el préstamo #{success.prestamoNuevoId} quedó ACTIVO.
          </p>
          <div className="result-grid">
            <strong>
              Capital refinanciado <b>{money(success.montoRefinanciado)}</b>
            </strong>
            <strong>
              Dinero nuevo{" "}
              <b>{money(success.nuevaOperacion.dineroNuevoDesembolsado)}</b>
            </strong>
            <strong>
              Capital total nuevo{" "}
              <b>{money(success.composicion.capitalTotalNuevo)}</b>
            </strong>
            <strong>
              Interés total nuevo{" "}
              <b>{money(success.composicion.interesTotalNuevo)}</b>
            </strong>
            <strong>
              Monto total nuevo{" "}
              <b>
                {money(
                  success.composicion.capitalTotalNuevo +
                    success.composicion.interesTotalNuevo,
                )}
              </b>
            </strong>
            <strong>
              Monto desembolsado{" "}
              <b>{money(success.nuevaOperacion.dineroNuevoDesembolsado)}</b>
            </strong>
          </div>
          {success.planNuevo && (
            <p>Plan nuevo: {success.planNuevo.length} cuotas.</p>
          )}
          {statementError && (
            <p className="form-error" role="alert">
              No se pudo generar el estado de cuenta. {" "}
              <button
                className="text-button"
                type="button"
                onClick={() => void openStatement()}
              >
                Reintentar
              </button>
            </p>
          )}
          <div className="form-actions">
            <button
              className="primary-button"
              type="button"
              disabled={statementLoading}
              onClick={() => void openStatement()}
            >
              <Printer size={16} />
              {statementLoading ? "Generando..." : "Estado de cuenta"}
            </button>
            <button className="secondary-button" type="button" onClick={reset}>
              Nuevo refinanciamiento
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => navigate("/refinanciamientos")}
            >
              Ir a refinanciamientos
            </button>
          </div>
        </div>
      </section>
    );
  return (
    <section className="new-refinancing-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">REFINANCIAMIENTOS</p>
          <h1>Nuevo refinanciamiento</h1>
        </div>
      </div>
      {catalogError && (
        <p className="form-error" role="alert">
          {catalogError}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="steps" aria-label="Pasos del refinanciamiento">
        <span className={step === 1 ? "current" : ""}>1. Préstamo origen</span>
        <span className={step === 2 ? "current" : ""}>
          2. Nuevas condiciones
        </span>
        <span className={step === 3 ? "current" : ""}>3. Confirmación</span>
      </div>
      {step === 1 && (
        <div className="refinancing-card">
          <div className="card-heading">
            <h2>Préstamo origen</h2>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setModal(true)}
            >
              <Search size={15} />{" "}
              {loan ? "Cambiar préstamo" : "Seleccionar préstamo"}
            </button>
          </div>
          {previewLoading && <p role="status">Consultando elegibilidad...</p>}
          {loan && preview && (
            <div className="preview-summary">
              <p>
                <b>Cliente</b>
                {preview.cliente.nombreCompleto} (
                {preview.cliente.identificacion})
              </p>
              <p>
                <b>Préstamo</b>#{preview.prestamo.id} ·{" "}
                {preview.prestamo.estado} · Alta{" "}
                {dateLabel(preview.prestamo.fechaAlta)}
              </p>
              <p>
                <b>Capital</b>
                {money(preview.prestamo.capital)} · <b>Interés</b>
                {money(preview.prestamo.interes)} · <b>Total pagado</b>
                {money(preview.totalPagado)}
              </p>
              <p>
                <b>Interés requerido</b>
                {money(preview.interesRequerido)} · <b>Interés faltante</b>
                {money(preview.interesPendienteParaRefinanciar)} ·{" "}
                <b>Capital amortizado</b>
                {money(preview.capitalAmortizadoRefinanciamiento)}
              </p>
              <strong className="capital-highlight">
                CAPITAL A REFINANCIAR:{" "}
                {money(preview.capitalPendienteRefinanciable)}
              </strong>
              {preview.elegible ? (
                <p className="success-text" role="status">
                  ✓ Interés cubierto
                </p>
              ) : (
                <p className="form-error" role="alert">
                  {preview.motivo ||
                    "El préstamo no es elegible para refinanciamiento."}
                </p>
              )}
            </div>
          )}
          {!loan && !previewLoading && (
            <p>Selecciona un préstamo activo para comenzar.</p>
          )}
          <div className="form-actions">
            <button
              className="primary-button"
              type="button"
              disabled={!preview?.elegible}
              onClick={() => setStep(2)}
            >
              Continuar
            </button>
          </div>
        </div>
      )}
      {step === 2 && (
        <form
          className="refinancing-layout"
          onSubmit={(event) => {
            event.preventDefault();
            if (canContinue) setStep(3);
          }}
        >
          <div className="refinancing-card conditions">
            <h2>Nuevas condiciones</h2>
            <div className="fields">
              <label htmlFor="ref-date">
                Fecha
                <input
                  id="ref-date"
                  type="date"
                  value={fecha}
                  onChange={(event) => setFecha(event.target.value)}
                />
              </label>
               <label htmlFor="ref-amount">
                 Monto nuevo desembolsado
                 <CurrencyInput
                   id="ref-amount"
                   inputMode="decimal"
                   value={monto}
                   onChange={setMonto}
                   aria-invalid={!validMoney(monto)}
                   aria-describedby="ref-amount-help"
                 />
                <small id="ref-amount-help">
                  Puede ser cero; si es mayor que cero exige forma de
                  desembolso.
                </small>
              </label>
              <label htmlFor="ref-disbursement">
                Forma de desembolso
                <select
                  id="ref-disbursement"
                  value={formaDesembolsoId}
                  onChange={(event) => setFormaDesembolsoId(event.target.value)}
                  disabled={amount === 0}
                  aria-required={amount > 0}
                >
                  <option value="">Seleccionar</option>
                  {formas.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nombre}
                    </option>
                  ))}
                </select>
              </label>
               <label htmlFor="ref-interest">
                 Monto interés nuevo
                 <CurrencyInput
                   id="ref-interest"
                   inputMode="decimal"
                   value={interes}
                   onChange={setInteres}
                   aria-invalid={!validMoney(interes)}
                 />
              </label>
              <label htmlFor="ref-period">
                Periodicidad
                <select
                  id="ref-period"
                  value={periodicidadId}
                  onChange={(event) => setPeriodicidadId(event.target.value)}
                >
                  <option value="">Seleccionar</option>
                  {periodicidades.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="ref-count">
                Cantidad de pagos
                <input
                  id="ref-count"
                  type="number"
                  min="1"
                  step="1"
                  value={cantidad}
                  onChange={(event) => {
                    const next = Math.max(1, Number(event.target.value) || 1);
                    setCantidad(String(next));
                    setCuotas(
                      Array.from(
                        { length: next },
                        (_, index) =>
                          cuotas[index] ?? {
                            numeroPago: index + 1,
                            fechaVencimiento: fecha,
                            montoProgramado: "0",
                          },
                      ),
                    );
                  }}
                />
              </label>
              <label htmlFor="ref-payment">
                Forma habitual de pago
                <select
                  id="ref-payment"
                  value={formaPagoId}
                  onChange={(event) => setFormaPagoId(event.target.value)}
                >
                  <option value="">Seleccionar</option>
                  {formas.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="checkbox-field" htmlFor="ref-custom">
                <input
                  id="ref-custom"
                  type="checkbox"
                  checked={personalizado}
                  onChange={(event) => setPersonalizado(event.target.checked)}
                />{" "}
                Plan personalizado
              </label>
              <label className="full-field" htmlFor="ref-notes">
                Observaciones
                <textarea
                  id="ref-notes"
                  maxLength={1000}
                  value={observaciones}
                  onChange={(event) => setObservaciones(event.target.value)}
                />
              </label>
            </div>
            {personalizado && (
              <div className="custom-plan">
                <h3>Cuotas personalizadas</h3>
                {cuotas.map((item, index) => (
                  <div className="installment-row" key={item.numeroPago}>
                    <b>#{item.numeroPago}</b>
                    <input
                      aria-label={`Fecha cuota ${item.numeroPago}`}
                      type="date"
                      value={item.fechaVencimiento}
                      onChange={(event) =>
                        setCuotas((current) =>
                          current.map((row, i) =>
                            i === index
                              ? { ...row, fechaVencimiento: event.target.value }
                              : row,
                          ),
                        )
                      }
                    />
                    <input
                      aria-label={`Monto cuota ${item.numeroPago}`}
                      inputMode="decimal"
                      value={item.montoProgramado}
                      onChange={(event) =>
                        setCuotas((current) =>
                          current.map((row, i) =>
                            i === index
                              ? { ...row, montoProgramado: event.target.value }
                              : row,
                          ),
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="form-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setStep(1)}
              >
                Atrás
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={!canContinue}
              >
                Continuar
              </button>
            </div>
          </div>
          <aside className="refinancing-card visual-preview">
            <h2>Vista previa</h2>
            <p>
              Capital transferido{" "}
              <b>{money(preview?.capitalPendienteRefinanciable)}</b>
            </p>
            <p>
              Dinero nuevo <b>{money(amount)}</b>
            </p>
            <p>
              Capital estimado{" "}
              <b>
                {money((preview?.capitalPendienteRefinanciable ?? 0) + amount)}
              </b>
            </p>
            <p>
              Total estimado{" "}
              <b>
                {money(
                  (preview?.capitalPendienteRefinanciable ?? 0) +
                    amount +
                    (interes ?? 0),
                )}
              </b>
            </p>
          </aside>
        </form>
      )}
      {step === 3 && (
        <form className="refinancing-card confirmation" onSubmit={submit}>
          <h2>Confirmación</h2>
          <div className="confirm-grid">
            <div>
              <h3>PRÉSTAMO ORIGEN</h3>
              <dl>
                <div>
                  <dt>Préstamo</dt>
                  <dd>#{preview?.prestamo.id ?? loan?.id ?? "—"}</dd>
                </div>
                <div>
                  <dt>Cliente</dt>
                  <dd>{preview?.cliente.nombreCompleto || "—"}</dd>
                </div>
                <div>
                  <dt>Capital original</dt>
                  <dd>{money(preview?.prestamo.capital)}</dd>
                </div>
                <div>
                  <dt>Interés original</dt>
                  <dd>{money(preview?.prestamo.interes)}</dd>
                </div>
                <div>
                  <dt>Total pagado</dt>
                  <dd>{money(preview?.totalPagado)}</dd>
                </div>
                <div>
                  <dt>Capital que se refinancia</dt>
                  <dd>
                    <b>{money(preview?.capitalPendienteRefinanciable)}</b>
                  </dd>
                </div>
              </dl>
            </div>
            <div>
              <h3>NUEVA OPERACIÓN</h3>
              <dl>
                <div>
                  <dt>Capital transferido</dt>
                  <dd>{money(preview?.capitalPendienteRefinanciable)}</dd>
                </div>
                <div>
                  <dt>Dinero nuevo</dt>
                  <dd>{money(amount)}</dd>
                </div>
                <div>
                  <dt>Forma de desembolso</dt>
                  <dd>{formaDesembolsoNombre}</dd>
                </div>
                <div>
                  <dt>Capital nuevo estimado</dt>
                  <dd>{money(capitalNuevoEstimado)}</dd>
                </div>
                <div>
                  <dt>Interés nuevo</dt>
                   <dd>{money(interes ?? 0)}</dd>
                </div>
                <div>
                  <dt>Total nuevo estimado</dt>
                  <dd>{money(totalNuevoEstimado)}</dd>
                </div>
                <div>
                  <dt>Forma habitual de pago</dt>
                  <dd>{formaPagoNombre}</dd>
                </div>
                <div>
                  <dt>Periodicidad</dt>
                  <dd>{periodicidadNombre}</dd>
                </div>
                <div>
                  <dt>Cantidad de pagos</dt>
                  <dd>{cantidad}</dd>
                </div>
                <div>
                  <dt>Fecha</dt>
                  <dd>{dateLabel(fecha)}</dd>
                </div>
              </dl>
            </div>
          </div>
          <p className="confirmation-message">
            El préstamo actual pasará a REFINANCIADO y se creará un nuevo
            préstamo ACTIVO.
          </p>
          {submitting && (
            <p role="status" aria-live="polite">
              Procesando refinanciamiento...
            </p>
          )}
          <div className="form-actions">
            <button
              className="secondary-button"
              type="button"
              disabled={submitting}
              onClick={() => setStep(2)}
            >
              Atrás
            </button>
            <button
              className="primary-button"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Procesando..." : "Confirmar refinanciamiento"}
            </button>
          </div>
        </form>
      )}
      {modal && (
        <LoanModal
          onSelect={(loan) => void selectLoan(loan)}
          onClose={() => setModal(false)}
        />
      )}
    </section>
  );
}
