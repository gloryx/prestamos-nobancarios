import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { FiltrosPrestamos, PrestamoParaExportacion, PrestamosResumen } from '../../domain/repositories/prestamo.repository';
import { DatosCobranza } from '../../application/services/indicador-cobranza.service';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const currencyFormat = '[$₡-es-CR] #,##0.00';
const dateValue = (value: string | Date): Date => {
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : value;
  const [year, month, day] = text.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};
const dateText = (value: Date): string => `${String(value.getDate()).padStart(2, '0')}-${String(value.getMonth() + 1).padStart(2, '0')}-${value.getFullYear()}`;
const filterDateText = (value: string): string => { const [year, month, day] = value.split('-'); return `${day}-${month}-${year}`; };
const displayFilter = (filtros: FiltrosPrestamos): string => [
  filtros.buscar?.trim() && `Búsqueda: ${filtros.buscar.trim()}`,
  filtros.direccion?.trim() && `Dirección: ${filtros.direccion.trim()}`,
  filtros.estados?.length ? `Estado: ${filtros.estados.join(', ')}` : filtros.estados ? 'Estado: ninguno' : undefined,
  filtros.fechaInicio && `Desde: ${filtros.fechaInicio}`,
  filtros.fechaFin && `Hasta: ${filtros.fechaFin}`,
].filter(Boolean).join(' | ') || 'Sin filtros';

export interface PrestamosExcelFile { buffer: Buffer; filename: string; type: string; }

@Injectable()
export class PrestamosExcelGenerator {
  async generate(prestamos: PrestamoParaExportacion[], cobranza: Map<number, DatosCobranza>, resumen: PrestamosResumen, filtros: FiltrosPrestamos): Promise<PrestamosExcelFile> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Gestión de préstamos';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Préstamos', { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });
    sheet.mergeCells('A1:M1'); sheet.getCell('A1').value = 'GESTIÓN DE PRÉSTAMOS'; sheet.getCell('A1').font = { bold: true, size: 16 };
    sheet.mergeCells('A2:M2'); sheet.getCell('A2').value = `Fecha de generación: ${dateText(new Date())}`;
    sheet.mergeCells('A3:M3'); sheet.getCell('A3').value = `Filtros activos: ${displayFilter(filtros)}`; sheet.getCell('A3').font = { italic: true, color: { argb: '666666' } };
    const headers = ['N° Préstamo', 'Cliente', 'Identificación', 'Dirección', 'Fecha de alta', 'Capital', 'Interés', 'Total', 'Recuperado', 'Pendiente', 'Estado', 'Cobranza', 'Fecha límite contractual'];
    const rows = prestamos.map((prestamo) => {
      const info = cobranza.get(prestamo.id!);
      return [prestamo.id, prestamo.cliente.nombre, prestamo.cliente.identificacion ?? '', prestamo.cliente.direccion ?? '', dateValue(prestamo.fechaAlta), prestamo.capital, prestamo.interes, prestamo.montoTotal, prestamo.recuperado, Math.max((prestamo.capital + prestamo.interes) - prestamo.recuperado, 0), prestamo.estado, info?.indicadorCobranza ?? '', info ? dateValue(info.fechaLimiteContractual) : null];
    });
    sheet.addTable({ name: 'PrestamosExportados', ref: 'A4', headerRow: true, style: { theme: 'TableStyleMedium2', showRowStripes: true }, columns: headers.map((name) => ({ name, filterButton: true })), rows });
    sheet.getRow(4).font = { bold: true }; sheet.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D9E2F3' } };
    [6, 7, 8, 9, 10].forEach((column) => { sheet.getColumn(column).numFmt = currencyFormat; });
    [5, 13].forEach((column) => { sheet.getColumn(column).numFmt = 'dd/mm/yyyy'; });
    [10, 32, 20, 28, 14, 16, 16, 16, 16, 16, 16, 18, 23].forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
    const summaryRow = Math.max(6, 6 + prestamos.length);
    sheet.getCell(`A${summaryRow}`).value = 'RESUMEN'; sheet.getCell(`A${summaryRow}`).font = { bold: true, size: 13 };
    [['Total', resumen.total], ['Prestado', resumen.prestado], ['Ganancia', resumen.ganancia], ['Recuperado', resumen.recuperado], ['Pendiente', resumen.pendiente]].forEach(([label, value], index) => { const row = sheet.getRow(summaryRow + index + 1); row.getCell(1).value = label; row.getCell(2).value = value as number; row.getCell(2).numFmt = currencyFormat; if (label === 'Total') row.getCell(2).numFmt = '0'; });
    return { buffer: Buffer.from(await workbook.xlsx.writeBuffer()), filename: this.filename(filtros), type: XLSX_MIME };
  }
  private filename(filtros: FiltrosPrestamos): string { const today = dateText(new Date()); return filtros.fechaInicio && filtros.fechaFin ? `Prestamos_${filterDateText(filtros.fechaInicio)}_al_${filterDateText(filtros.fechaFin)}.xlsx` : `Prestamos_Filtrados_${today}.xlsx`; }
}
