import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Printer,
  Search,
  X,
} from "lucide-react";
import { listarClientes } from "@/features/clientes/application/clientes.use-cases";
import { clienteErrorMessage } from "@/features/clientes/domain/cliente.error";
import type {
  Cliente,
  ClienteFilters,
  ClientePage,
} from "@/features/clientes/domain/cliente.types";
import { AxiosClienteRepository } from "@/features/clientes/infrastructure/axios-cliente.repository";
import { abrirEstadoCuentaPdf } from "@/features/prestamos/application/prestamos.use-cases";
import { AxiosPrestamoRepository } from "@/features/prestamos/infrastructure/axios-prestamo.repository";
import { formatCRC } from "@/shared/utils/currency";
import { listarCadenasPorCliente } from "../application/cadenas.use-case";
import type {
  Cadena,
  CadenasClienteResponse,
  PrestamoCadena,
} from "../domain/cadenas.types";
import { AxiosCadenasRepository } from "../infrastructure/axios-cadenas.repository";
import "./cadenas-refinanciamiento.css";

const clienteRepository = new AxiosClienteRepository();
const cadenasRepository = new AxiosCadenasRepository();
const prestamoRepository = new AxiosPrestamoRepository();
const nombreCliente = (c: Cliente) =>
  [c.primerNombre, c.segundoNombre, c.primerApellido, c.segundoApellido]
    .filter(Boolean)
    .join(" ");
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

function ClientePicker({ onSelect }: { onSelect: (cliente: Cliente) => void }) {
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
      const result = await listarClientes(clienteRepository, filters);
      if (id === requestId.current) setPage(result);
    } catch (cause) {
      if (id === requestId.current) {
        setPage(null);
        setError(clienteErrorMessage(cause));
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [debounced, pagina]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(buscar.trim());
      setPagina(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [buscar]);
  useEffect(() => {
    if (open) void load();
  }, [load, open]);
  return (
    <>
      <button
        type="button"
        className="secondary-button"
        onClick={() => setOpen(true)}
      >
        <Search size={16} /> Buscar cliente
      </button>
      {open && (
        <div
          className="cliente-selector-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            className="cliente-selector-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cadenas-selector-title"
          >
            <div className="cliente-selector-header">
              <h2 id="cadenas-selector-title">Seleccionar cliente</h2>
              <button
                type="button"
                className="table-action"
                onClick={() => setOpen(false)}
                aria-label="Cerrar selector de cliente"
              >
                <X size={19} />
              </button>
            </div>
            <label className="analisis-client-search">
              Nombre o identificación
              <input
                value={buscar}
                placeholder="Buscar por nombre o identificación"
                onChange={(event) => setBuscar(event.target.value)}
              />
            </label>
            {loading && (
              <div className="state-box" role="status">
                Cargando clientes...
              </div>
            )}
            {!loading && error && (
              <div className="cliente-selector-error" role="alert">
                <p>{error}</p>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void load()}
                >
                  Reintentar
                </button>
              </div>
            )}
            {!loading && !error && page && (
              <div className="table-wrap cliente-selector-table-wrap">
                <table className="cliente-selector-table">
                  <thead>
                    <tr>
                      <th>Identificación</th>
                      <th>Nombre</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.datos.map((cliente) => (
                      <tr key={cliente.id}>
                        <td>{cliente.identificacion}</td>
                        <td>{nombreCliente(cliente)}</td>
                        <td>
                          <button
                            type="button"
                            className="primary-button"
                            onClick={() => {
                              onSelect(cliente);
                              setOpen(false);
                            }}
                          >
                            Seleccionar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!page.datos.length && (
                  <p className="form-note">No hay clientes para mostrar.</p>
                )}
              </div>
            )}
            {!loading && !error && page && (
              <div className="cliente-selector-pagination">
                <button
                  type="button"
                  className="table-action"
                  aria-label="Página anterior"
                  disabled={pagina <= 1}
                  onClick={() => setPagina((value) => value - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  Página {pagina} de {Math.max(page.totalPaginas, 1)} ·{" "}
                  {page.total} clientes
                </span>
                <button
                  type="button"
                  className="table-action"
                  aria-label="Página siguiente"
                  disabled={pagina >= page.totalPaginas}
                  onClick={() => setPagina((value) => value + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

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
        <strong>Préstamo #{loan.id}</strong>
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
}: {
  chain: Cadena;
  statementStates: Record<number, "loading" | "error">;
  onStatement: (id: number) => void;
}) {
  const transitions = new Map(
    chain.transiciones.map((transition) => [
      transition.prestamoNuevoId,
      transition,
    ]),
  );
  return (
    <section
      className="panel cadena-section"
      aria-labelledby={`cadena-${chain.prestamoRaizId}`}
    >
      <div className="cadena-heading">
        <div>
          <h2 id={`cadena-${chain.prestamoRaizId}`}>
            <FileText size={17} aria-hidden="true" /> Cadena desde préstamo #
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
        <strong>Terminal #{chain.prestamoTerminalId}</strong>
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
                      <span>
                        Transición: #{transition.prestamoOrigenId} a #
                        {transition.prestamoNuevoId}
                      </span>
                      <dl className="transition-details">
                        <div>
                          <dt>C. trasladado.</dt>
                          <dd>{formatCRC(transition.capitalTrasladado)}</dd>
                        </div>
                        <div className="transition-detail-new-money">
                          <dt>Dinero nuevo</dt>
                          <dd>
                            {formatCRC(transition.dineroNuevoDesembolsado)}
                            {transition.dineroNuevoDesembolsado === 0 && (
                              <small>Sin dinero nuevo</small>
                            )}
                          </dd>
                        </div>
                        <div className="transition-detail-interest">
                          <dt>Interés nuevo</dt>
                          <dd>{formatCRC(transition.interesNuevo)}</dd>
                        </div>
                        <div
                          className="transition-detail-days"
                          title={daysTooltip(
                            transition.fechaLimiteContractualOrigen,
                          )}
                        >
                          <dt>Días ganados</dt>
                          <dd>{daysLabel(transition.diasGanados)}</dd>
                        </div>
                      </dl>
                      <p>
                        Fecha: {dateLabel(transition.fecha)}. El préstamo
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
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [response, setResponse] = useState<CadenasClienteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statementStates, setStatementStates] = useState<
    Record<number, "loading" | "error">
  >({});
  const requestId = useRef(0);
  const selectClient = (value: Cliente) => {
    const id = ++requestId.current;
    setCliente(value);
    setResponse(null);
    setError("");
    setLoading(true);
    void listarCadenasPorCliente(cadenasRepository, value.id)
      .then((result) => {
        if (id === requestId.current) setResponse(result);
      })
      .catch(() => {
        if (id === requestId.current)
          setError("No se pudieron cargar las cadenas de refinanciamiento.");
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  };
  const retry = () => {
    if (cliente) selectClient(cliente);
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
          <h1>Cadenas de refinanciamiento</h1>
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
            <h2>{nombreCliente(cliente)}</h2>
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
            <div className="panel cadenas-summary-item">
              <span>Cadenas</span>
              <strong>{response.resumen.cantidadCadenas}</strong>
            </div>
            <div className="panel cadenas-summary-item">
              <span>Refinanciamientos</span>
              <strong>{response.resumen.cantidadRefinanciamientos}</strong>
            </div>
            <div className="panel cadenas-summary-item">
              <span>Capital trasladado</span>
              <strong>
                {formatCRC(response.resumen.totalCapitalTrasladado)}
              </strong>
            </div>
            <div className="panel cadenas-summary-item">
              <span>Dinero nuevo</span>
              <strong>
                {formatCRC(response.resumen.totalDineroNuevoDesembolsado)}
              </strong>
            </div>
            <div className="panel cadenas-summary-item">
              <span>Interés nuevo pactado</span>
              <strong>
                {formatCRC(response.resumen.totalInteresNuevoPactado)}
              </strong>
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
