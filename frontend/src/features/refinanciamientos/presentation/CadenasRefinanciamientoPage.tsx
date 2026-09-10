import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRightLeft,
  Banknote,
  CalendarClock,
  CalendarDays,
  CircleDollarSign,
  FileText,
  HandCoins,
  Link2,
  Printer,
  RefreshCw,
  TrendingUp,
  UserRound,
  WalletCards,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import type {
  Cliente,
} from "@/features/clientes/domain/cliente.types";
import { abrirEstadoCuentaPdf } from "@/features/prestamos/application/prestamos.use-cases";
import { AxiosPrestamoRepository } from "@/features/prestamos/infrastructure/axios-prestamo.repository";
import { formatCRC } from "@/shared/utils/currency";
import { listarCadenasPorCliente } from "../application/cadenas.use-case";
import type {
  Cadena,
  CadenaCliente,
  CadenasClienteResponse,
  PrestamoCadena,
} from "../domain/cadenas.types";
import { AxiosCadenasRepository } from "../infrastructure/axios-cadenas.repository";
import { ClientePicker } from "./ClientePicker";
import "./cadenas-refinanciamiento.css";

const cadenasRepository = new AxiosCadenasRepository();
const prestamoRepository = new AxiosPrestamoRepository();
const nombreCliente = (c: Pick<Cliente, "primerNombre" | "segundoNombre" | "primerApellido" | "segundoApellido"> | CadenaCliente) =>
  "nombreCompleto" in c ? c.nombreCompleto : [c.primerNombre, c.segundoNombre, c.primerApellido, c.segundoApellido].filter(Boolean).join(" ");
const dateLabel = (value: string) =>
  value ? value.slice(0, 10).split("-").reverse().join("/") : "—";
const statusClass = (value: string) =>
  `prestamo-status prestamo-status-${value.toLowerCase()}`;
const daysLabel = (value: number | null) =>
  value === null ? "—" : `${value} ${value === 1 ? "día" : "días"}`;
const daysTooltip = (contractualDate: string | null) =>
  contractualDate
    ? `Días de anticipación con que se inició una nueva operación respecto al vencimiento previsto del préstamo anterior. Vencimiento previsto: ${dateLabel(contractualDate)}.`
    : "Información histórica no disponible.";
const netClass = (value: number) =>
  value >= 0 ? "cadena-summary-net-positive" : "cadena-summary-net-negative";

function LoanNode({
  loan,
  state,
  onStatement,
}: {
  loan: PrestamoCadena;
  state?: "loading" | "error";
  onStatement: (id: number) => void;
}) {
  return (
    <article className="loan-node">
      <div className="loan-node-header">
        <strong><FileText size={16} aria-hidden="true" /> Préstamo #{loan.id}</strong>
        <span className={statusClass(loan.estado)}>{loan.estado}</span>
      </div>
      <dl>
        <dt>Capital</dt>
        <dd>{formatCRC(loan.capital)}</dd>
        <dt>Interés</dt>
        <dd>{formatCRC(loan.interes)}</dd>
        <dt>Total</dt>
        <dd>{formatCRC(loan.montoTotal)}</dd>
        {loan.montoDesembolsado > 0 && (
          <>
            <dt>Desembolsado</dt>
            <dd>{formatCRC(loan.montoDesembolsado)}</dd>
          </>
        )}
      </dl>
      <button
        type="button"
        className="secondary-button loan-node-action"
        disabled={state === "loading"}
        onClick={() => onStatement(loan.id)}
      >
        <Printer size={15} />{" "}
        {state === "loading" ? "Abriendo..." : "Estado de cuenta"}
      </button>
      {state === "error" && (
        <p className="loan-node-error" role="alert">
          No se pudo abrir el estado de cuenta.
        </p>
      )}
    </article>
  );
}

function ChainSection({
  chain,
  statementStates,
  onStatement,
  highlighted,
}: {
  chain: Cadena;
  statementStates: Record<number, "loading" | "error">;
  onStatement: (id: number) => void;
  highlighted?: boolean;
}) {
  const transitions = new Map(
    chain.transiciones.map((transition) => [
      transition.prestamoNuevoId,
      transition,
    ]),
  );
  return (
    <section
      className={`panel cadena-section${highlighted ? " cadena-section-highlighted" : ""}`}
      aria-labelledby={`cadena-${chain.prestamoRaizId}`}
    >
      <div className="cadena-heading">
        <div>
          <h2 id={`cadena-${chain.prestamoRaizId}`}>
            <Link2 size={17} aria-hidden="true" /> Cadena desde préstamo #
            {chain.prestamoRaizId}
          </h2>
          <div className="cadena-meta">
            <span>
              Inicio <strong>{dateLabel(chain.fechaInicio)}</strong>
            </span>
            <span>
              {chain.resumen.cantidadPrestamos} préstamos ·{" "}
              {chain.resumen.cantidadRefinanciamientos} refinanciamientos
            </span>
          </div>
        </div>
         <strong className="cadena-terminal"><CircleDollarSign size={15} aria-hidden="true" /> Terminal #{chain.prestamoTerminalId}</strong>
      </div>
      <div className="cadena-summary" aria-label="Resumen de la cadena">
        <div className="panel cadenas-summary-item cadenas-summary-delivered">
          <span
            className="cadenas-summary-label"
            title="Dinero que efectivamente salió hacia el cliente: desembolso inicial más dinero nuevo entregado en refinanciamientos."
          >
            <span className="summary-icon"><HandCoins size={16} aria-hidden="true" /></span> Monto realmente entregado
          </span>
          <strong>{formatCRC(chain.resumen.montoRealmenteEntregado)}</strong>
        </div>
        <div className="panel cadenas-summary-item cadenas-summary-received">
          <span
            className="cadenas-summary-label"
            title="Pagos efectivos registrados recibidos en todos los préstamos que forman parte de las cadenas."
          >
            <span className="summary-icon"><CircleDollarSign size={16} aria-hidden="true" /></span> Monto realmente recibido
          </span>
          <strong>{formatCRC(chain.resumen.montoRealmenteRecibido)}</strong>
        </div>
        <div className={`panel cadenas-summary-item cadena-summary-net ${netClass(chain.resumen.efectivoNetoRecuperado)}`}>
          <span
            className="cadenas-summary-label"
            title="Diferencia entre dinero realmente recibido y dinero realmente entregado. No representa utilidad."
          >
            <span className="summary-icon"><WalletCards size={16} aria-hidden="true" /></span> Efectivo neto recuperado
          </span>
          <strong>{formatCRC(chain.resumen.efectivoNetoRecuperado)}</strong>
        </div>
      </div>
      <div
        className="cadena-flow"
        aria-label={`Secuencia de la cadena desde el préstamo ${chain.prestamoRaizId}`}
      >
        {chain.prestamos.map((loan, index) => (
          <div className="chain-step" key={loan.id}>
            <LoanNode
              loan={loan}
              state={statementStates[loan.id]}
              onStatement={onStatement}
            />
            {index < chain.prestamos.length - 1 &&
              (() => {
                const transition = transitions.get(
                  chain.prestamos[index + 1].id,
                );
                return transition ? (
                  <div className="chain-connector">
                    <div className="transition-card">
                      <span className="transition-heading">
                        <ArrowRightLeft size={15} aria-hidden="true" /> Transición: #{transition.prestamoOrigenId} a #
                        {transition.prestamoNuevoId}
                      </span>
                      <dl className="transition-details">
                          <div className="transition-detail-capital" title="Capital pendiente trasladado desde el préstamo anterior.">
                          <dt><ArrowRightLeft size={13} aria-hidden="true" /> C. trasladado.</dt>
                          <dd>{formatCRC(transition.capitalTrasladado)}</dd>
                        </div>
                        <div className="transition-detail-new-money" title="Dinero nuevo entregado al cliente en esta refinanciación.">
                          <dt><Banknote size={13} aria-hidden="true" /> Dinero nuevo</dt>
                          <dd>
                            {formatCRC(transition.dineroNuevoDesembolsado)}
                            {transition.dineroNuevoDesembolsado === 0 && (
                              <small>Sin dinero nuevo</small>
                            )}
                          </dd>
                        </div>
                        <div className="transition-detail-interest" title="Interés nuevo pactado para el préstamo.">
                            <dt><TrendingUp size={13} aria-hidden="true" /> Interés nuevo</dt>
                          <dd>{formatCRC(transition.interesNuevo)}</dd>
                        </div>
                        <div
                          className="transition-detail-days"
                          title={daysTooltip(
                            transition.fechaLimiteContractualOrigen,
                          )}
                        >
                           <dt><CalendarClock size={13} aria-hidden="true" /> Días ganados</dt>
                          <dd>{daysLabel(transition.diasGanados)}</dd>
                        </div>
                      </dl>
                       <p>
                         <CalendarDays size={13} aria-hidden="true" /> Fecha: {dateLabel(transition.fecha)}. El préstamo
                        siguiente continúa esta cadena.
                      </p>
                    </div>
                  </div>
                ) : null;
              })()}
          </div>
        ))}
      </div>
    </section>
  );
}

export function CadenasRefinanciamientoPage() {
  const location = useLocation();
  const [cliente, setCliente] = useState<Cliente | CadenaCliente | null>(null);
  const [response, setResponse] = useState<CadenasClienteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statementStates, setStatementStates] = useState<
    Record<number, "loading" | "error">
  >({});
  const requestId = useRef(0);
  const [chainTarget, setChainTarget] = useState<{ prestamoOrigenId: number; prestamoNuevoId: number } | null>(null);
  const loadClient = useCallback((value: Cliente | CadenaCliente) => {
    const id = ++requestId.current;
    setCliente(value);
    setResponse(null);
    setError("");
    setLoading(true);
    void listarCadenasPorCliente(cadenasRepository, value.id)
      .then((result) => {
        if (id === requestId.current) { setResponse(result); setCliente(result.cliente); }
      })
      .catch(() => {
        if (id === requestId.current)
          setError("No se pudieron cargar las cadenas de refinanciamiento.");
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, []);
  const selectClient = (value: Cliente) => loadClient(value);
  useEffect(() => {
    const state = location.state;
    if (!state || typeof state !== "object") return;
    const candidate = state as Record<string, unknown>;
    const clienteId = candidate.clienteId;
    const prestamoOrigenId = candidate.prestamoOrigenId;
    const prestamoNuevoId = candidate.prestamoNuevoId;
    if (![clienteId, prestamoOrigenId, prestamoNuevoId].every((value) => typeof value === "number" && Number.isInteger(value) && value > 0)) return;
    setChainTarget({ prestamoOrigenId: prestamoOrigenId as number, prestamoNuevoId: prestamoNuevoId as number });
    loadClient({ id: clienteId as number, identificacion: "", nombreCompleto: "Cliente seleccionado" });
  }, [loadClient, location.state]);
  const retry = () => {
    if (cliente) loadClient(cliente);
  };
  const statement = async (id: number) => {
    setStatementStates((current) => ({ ...current, [id]: "loading" }));
    try {
      await abrirEstadoCuentaPdf(prestamoRepository, id);
      setStatementStates((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    } catch {
      setStatementStates((current) => ({ ...current, [id]: "error" }));
    }
  };
  return (
    <section className="cadenas-page">
      <div className="page-heading">
        <div>
           <p className="eyebrow">REFINANCIAMIENTOS</p>
           <h1><Link2 size={24} aria-hidden="true" /> Cadenas de refinanciamiento</h1>
          <p className="muted">
            Visualiza la continuidad de las operaciones de un cliente.
          </p>
        </div>
      </div>
      {!cliente && (
        <div className="panel cadenas-initial">
          <h2>
            Selecciona un cliente para visualizar sus cadenas de
            refinanciamiento.
          </h2>
          <p>Busca un cliente para consultar sus cadenas.</p>
          <ClientePicker onSelect={selectClient} />
        </div>
      )}
      {cliente && (
        <div className="panel cadenas-client-header">
          <div>
          <h2><UserRound size={18} aria-hidden="true" /> {nombreCliente(cliente)}</h2>
            <p>
              <strong>Identificación:</strong> {cliente.identificacion}
            </p>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setCliente(null);
              setResponse(null);
              setError("");
              setStatementStates({});
            }}
          >
            Cambiar cliente
          </button>
        </div>
      )}
      {loading && (
        <div className="panel state-box" role="status">
          Cargando cadenas de refinanciamiento...
        </div>
      )}
      {error && (
        <div className="panel cadenas-error" role="alert">
          <p>{error}</p>
          <button type="button" className="primary-button" onClick={retry}>
            Reintentar
          </button>
        </div>
      )}
      {response && (
        <>
          <div className="cadenas-summary" aria-label="Resumen de cadenas">
            <div className="cadenas-summary-row">
               <div className="panel cadenas-summary-item">
                <span title="Cantidad de cadenas registradas para el cliente."><span className="summary-icon"><Link2 size={16} aria-hidden="true" /></span> Cadenas</span>
                <strong>{response.resumen.cantidadCadenas}</strong>
              </div>
               <div className="panel cadenas-summary-item cadenas-summary-delivered">
                <span title="Cantidad de refinanciamientos registrados en las cadenas."><span className="summary-icon"><RefreshCw size={16} aria-hidden="true" /></span> Refinanciamientos</span>
                <strong>{response.resumen.cantidadRefinanciamientos}</strong>
              </div>
              <div className="panel cadenas-summary-item">
                <span title="Capital pendiente trasladado desde préstamos anteriores."><span className="summary-icon"><ArrowRightLeft size={16} aria-hidden="true" /></span> Capital trasladado</span>
                <strong>
                  {formatCRC(response.resumen.totalCapitalTrasladado)}
                </strong>
              </div>
              <div className="panel cadenas-summary-item">
                <span title="Dinero nuevo desembolsado en refinanciamientos."><span className="summary-icon"><Banknote size={16} aria-hidden="true" /></span> Dinero nuevo</span>
                <strong>
                  {formatCRC(response.resumen.totalDineroNuevoDesembolsado)}
                </strong>
              </div>
              <div className="panel cadenas-summary-item">
                <span title="Interés nuevo pactado en refinanciamientos."><span className="summary-icon"><TrendingUp size={16} aria-hidden="true" /></span> Interés nuevo pactado</span>
                <strong>
                  {formatCRC(response.resumen.totalInteresNuevoPactado)}
                </strong>
              </div>
            </div>
            <div className="cadenas-summary-row cadenas-summary-row-secondary">
              <div className="panel cadenas-summary-item">
                <span
                  className="cadenas-summary-label"
                  title="Dinero que efectivamente salió hacia el cliente: desembolso inicial más dinero nuevo entregado en refinanciamientos."
                >
                   <span className="summary-icon"><HandCoins size={16} aria-hidden="true" /></span> Monto realmente entregado
                </span>
                <strong>{formatCRC(response.resumen.montoRealmenteEntregado)}</strong>
              </div>
               <div className="panel cadenas-summary-item cadenas-summary-received">
                <span
                  className="cadenas-summary-label"
                  title="Pagos efectivos registrados recibidos en todos los préstamos que forman parte de las cadenas."
                >
                   <span className="summary-icon"><CircleDollarSign size={16} aria-hidden="true" /></span> Monto realmente recibido
                </span>
                <strong>{formatCRC(response.resumen.montoRealmenteRecibido)}</strong>
              </div>
              <div className={`panel cadenas-summary-item cadena-summary-net ${netClass(response.resumen.efectivoNetoRecuperado)}`}>
                <span
                  className="cadenas-summary-label"
                  title="Diferencia entre dinero realmente recibido y dinero realmente entregado. No representa utilidad."
                >
                   <span className="summary-icon"><WalletCards size={16} aria-hidden="true" /></span> Efectivo neto recuperado
                </span>
                <strong>{formatCRC(response.resumen.efectivoNetoRecuperado)}</strong>
              </div>
               <div
                 className="panel cadenas-summary-item cadenas-summary-days"
                title={daysTooltip(null)}
              >
                <span className="cadenas-summary-label">
                  <span className="summary-icon"><CalendarClock size={16} aria-hidden="true" /></span>
                  {response.resumen.diasGanadosCompletos
                    ? "Días ganados"
                    : "Días ganados conocidos"}
                </span>
                <strong>
                  {response.resumen.diasGanadosAcumulados} días
                </strong>
              </div>
            </div>
          </div>
          {response.cadenas.length === 0 ? (
            <div className="panel state-box">
              Este cliente no tiene cadenas de refinanciamiento registradas.
            </div>
          ) : (
            response.cadenas.map((chain) => (
               <ChainSection
                 key={chain.prestamoRaizId}
                 chain={chain}
                 highlighted={Boolean(chainTarget && (chain.prestamos.some((loan) => loan.id === chainTarget.prestamoOrigenId || loan.id === chainTarget.prestamoNuevoId) || chain.transiciones.some((transition) => transition.prestamoOrigenId === chainTarget.prestamoOrigenId || transition.prestamoNuevoId === chainTarget.prestamoNuevoId)))}
                statementStates={statementStates}
                onStatement={(id) => void statement(id)}
              />
            ))
          )}
        </>
      )}
      {Object.entries(statementStates).some(
        ([, state]) => state === "error",
      ) && (
        <p className="form-error" role="alert">
          No se pudo abrir uno o más estados de cuenta.
        </p>
      )}
    </section>
  );
}
