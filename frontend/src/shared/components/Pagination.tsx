import "./pagination.css";
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from "lucide-react";

type PageNumber = number | "ellipsis";

export interface PaginationProps {
  pagina: number;
  totalPaginas: number;
  total: number;
  limite: number;
  opcionesLimite: number[];
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  label: string;
  loading?: boolean;
  disabled?: boolean;
}

export function Pagination({ pagina, totalPaginas, total, limite, opcionesLimite, onPageChange, onLimitChange, label, loading = false, disabled = false }: PaginationProps) {
  const isDisabled = loading || disabled;
  const currentPage = totalPaginas > 0 ? Math.min(Math.max(1, pagina), totalPaginas) : 1;
  const firstItem = total === 0 ? 0 : (currentPage - 1) * limite + 1;
  const lastItem = total === 0 ? 0 : Math.min(currentPage * limite, total);
  const pageNumbers: PageNumber[] = totalPaginas <= 7
    ? Array.from({ length: totalPaginas }, (_, index) => index + 1)
    : Array.from(new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPaginas])).filter((value) => value > 0 && value <= totalPaginas).sort((a, b) => a - b).reduce<PageNumber[]>((items, value, index, values) => { if (index > 0 && value - values[index - 1] > 1) items.push("ellipsis"); items.push(value); return items; }, []);
  const goToPage = (value: number) => { if (!isDisabled && totalPaginas > 0) onPageChange(Math.min(Math.max(1, value), totalPaginas)); };
  const firstOrPreviousDisabled = isDisabled || totalPaginas === 0 || currentPage === 1;
  const nextOrLastDisabled = isDisabled || totalPaginas === 0 || currentPage === totalPaginas;

  return <nav className="shared-pagination" aria-label={`Paginación de ${label}`}><span className="shared-pagination-range">{total === 0 ? `Mostrando 0 ${label}` : `Mostrando ${firstItem}-${lastItem} de ${total} ${label}`}</span><div className="shared-pagination-controls"><button className="table-action" type="button" aria-label="Primera página" title="Primera página" disabled={firstOrPreviousDisabled} onClick={() => goToPage(1)}><ChevronFirst size={16} /></button><button className="table-action" type="button" aria-label="Página anterior" title="Página anterior" disabled={firstOrPreviousDisabled} onClick={() => goToPage(currentPage - 1)}><ChevronLeft size={16} /></button>{pageNumbers.map((item, index) => item === "ellipsis" ? <span className="shared-pagination-ellipsis" aria-hidden="true" key={`ellipsis-${index}`}>…</span> : <button className={`table-action shared-pagination-page${item === currentPage ? " is-active" : ""}`} type="button" aria-label={`Ir a la página ${item}`} title={`Página ${item}`} aria-current={item === currentPage ? "page" : undefined} disabled={isDisabled} onClick={() => goToPage(item)} key={item}>{item}</button>)}<button className="table-action" type="button" aria-label="Página siguiente" title="Página siguiente" disabled={nextOrLastDisabled} onClick={() => goToPage(currentPage + 1)}><ChevronRight size={16} /></button><button className="table-action" type="button" aria-label="Última página" title="Última página" disabled={nextOrLastDisabled} onClick={() => goToPage(totalPaginas)}><ChevronLast size={16} /></button></div><label className="shared-pagination-page-size">Mostrar<select aria-label={`Filas por página de ${label}`} value={limite} disabled={isDisabled} onChange={(event) => onLimitChange(Number(event.target.value))}>{opcionesLimite.map((value) => <option key={value} value={value}>{value}</option>)}</select> por página</label></nav>;
}
