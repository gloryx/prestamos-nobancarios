import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Download,
  MoreHorizontal,
  TrendingUp,
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import {
  activity,
  chartData,
  financialSummary,
  indicators,
  monthlyResult,
  movements,
  overdue,
  upcoming,
} from "./dashboardData";

export function DashboardPage() {
  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <p className="eyebrow">MIÉRCOLES, 12 DE JUNIO DE 2024</p>
          <h1>Buenos días, Administrador</h1>
          <p className="muted">
            Este es el resumen de tu operación financiera.
          </p>
        </div>
        <button className="secondary-button">
          <Download size={16} /> Exportar reporte
        </button>
      </div>
      <div className="indicator-grid">
        {indicators.map((item) => (
          <div className={`indicator-card ${item.tone}`} key={item.label}>
            <div className="indicator-top">
              <span>{item.label}</span>
              <CircleDollarSign size={19} />
            </div>
            <strong>{item.value}</strong>
            <small>
              <TrendingUp size={13} /> {item.change} <em>vs. mes anterior</em>
            </small>
          </div>
        ))}
      </div>
      <section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">ANÁLISIS DEL MES ACTUAL</p>
            <h2>Resumen de la operación</h2>
          </div>
          <button className="period-button">
            <CalendarDays size={15} /> Este mes <ChevronRight size={14} />
          </button>
        </div>
        <div className="analysis-grid">
          <div className="panel summary-panel">
            <PanelTitle title="RESUMEN FINANCIERO" />
            <div className="summary-list">
              {financialSummary.map(([label, value]) => (
                <div className="summary-row" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className="panel chart-panel">
            <PanelTitle
              title="ACTIVIDAD DEL MES"
              subtitle="Pagos registrados por mes"
            />
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#8d99a8", fontSize: 11 }}
                  />
                  <Tooltip
                    cursor={{ fill: "#f4f7f8" }}
                    formatter={(value) => [`₡${value}M`, "Pagos"]}
                  />
                  <Bar
                    dataKey="value"
                    fill="var(--color-primary)"
                    radius={[5, 5, 0, 0]}
                    barSize={25}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="panel activity-panel">
            <PanelTitle title="ACTIVIDAD DEL MES" />
            <div className="activity-grid">
              {activity.map((item) => (
                <div className="activity-item" key={item.label}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                  <small>{item.detail}</small>
                </div>
              ))}
            </div>
          </div>
          <div className="panel movements-panel">
            <PanelTitle title="MOVIMIENTOS DEL MES" />
            {movements.map((item) => (
              <div className="movement-row" key={item.label}>
                <span>
                  {item.tone === "positive" ? (
                    <ArrowDownRight />
                  ) : (
                    <ArrowUpRight />
                  )}{" "}
                  {item.label}
                </span>
                <strong className={item.tone}>{item.value}</strong>
              </div>
            ))}
          </div>
          <div className="panel result-panel">
            <PanelTitle title="RESULTADO MENSUAL" />
            <div className="result-list">
              {monthlyResult.map(([label, value], index) => (
                <div
                  className={
                    index === monthlyResult.length - 1 ? "result-total" : ""
                  }
                  key={label}
                >
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <div className="lower-grid">
        <DataTable
          title="PRÓXIMOS COBROS"
          columns={["Cliente", "Fecha", "Monto"]}
          rows={upcoming.map((row) => [row.client, row.date, row.amount])}
        />
        <DataTable
          title="CLIENTES ATRASADOS"
          columns={["Cliente", "Días de atraso", "Saldo pendiente"]}
          rows={overdue.map((row) => [row.client, row.days, row.amount])}
          overdue
        />
      </div>
    </div>
  );
}

function PanelTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="panel-title">
      <div>
        <h3>{title}</h3>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      <MoreHorizontal size={18} aria-hidden="true" />
    </div>
  );
}
function DataTable({
  title,
  columns,
  rows,
  overdue: isOverdue = false,
}: {
  title: string;
  columns: string[];
  rows: string[][];
  overdue?: boolean;
}) {
  return (
    <div className="panel table-panel">
      <div className="panel-title">
        <h3>{title}</h3>
        <button className="text-button">
          Ver todos <ChevronRight size={14} />
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[0]}>
                {row.map((cell, index) => (
                  <td
                    className={
                      isOverdue && index === 2
                        ? "warning"
                        : index > 0
                          ? "amount"
                          : ""
                    }
                    key={`${row[0]}-${cell}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
