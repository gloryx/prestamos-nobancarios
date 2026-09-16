import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { FiltrosPagos, PagosExportacion } from '../../domain/repositories/pago.repository';
import { FiltrosPagosDto } from '../../application/dto/filtros-pagos.dto';

const MM = 72 / 25.4;
const MARGIN = 11 * MM;
const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const CR_TIME_ZONE = 'America/Costa_Rica';
const FONT_DIRECTORY = resolve(__dirname, 'fonts');
const FONT_REGULAR = resolve(FONT_DIRECTORY, 'NotoSans-Regular.ttf');
const FONT_BOLD = resolve(FONT_DIRECTORY, 'NotoSans-Bold.ttf');

const dateOnly = (value: Date | string | null | undefined): string => {
  if (!value) return '—';
  return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
};
const displayDate = (value: Date | string | null | undefined): string => {
  const date = dateOnly(value);
  return date === '—' ? date : `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
};
const civilNow = (): string => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: CR_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.day}/${values.month}/${values.year} ${values.hour}:${values.minute}`;
};
const crc = (value: number): string => `₡${value.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const friendlyStatus = (value: string | undefined): string => value === 'REGISTRADO' ? 'Registrados' : value === 'ANULADO' ? 'Anulados' : 'Todos';

@Injectable()
export class PagosPdfService {
  generar(result: PagosExportacion, filtros: FiltrosPagosDto): Promise<Buffer> {
    const document = new PDFDocument({ size: 'A4', layout: 'landscape', margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN }, bufferPages: true, info: { Title: 'Historial de pagos' } });
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);
      this.render(document, result, filtros);
      document.end();
    });
  }

  private render(document: PDFKit.PDFDocument, result: PagosExportacion, filtros: FiltrosPagos): void {
    if (!existsSync(FONT_REGULAR) || !existsSync(FONT_BOLD)) {
      throw new Error(`Unicode PDF fonts are not available at ${FONT_DIRECTORY}`);
    }
    document.registerFont('Unicode', FONT_REGULAR);
    document.registerFont('Unicode-Bold', FONT_BOLD);
    const width = PAGE_WIDTH - MARGIN * 2;
    const columns = [
      { label: 'Fecha', width: 47 }, { label: 'Cliente + ID', width: 132 }, { label: 'Préstamo', width: 49 },
      { label: 'Cuota', width: 40 }, { label: 'Monto', width: 68 }, { label: 'Capital', width: 65 },
      { label: 'Interés', width: 65 }, { label: 'Forma', width: 67 }, { label: 'Cobrador', width: 125 }, { label: 'Estado', width: 65 },
    ];
    const scale = width / columns.reduce((sum, column) => sum + column.width, 0);
    columns.forEach((column) => { column.width *= scale; });
    let y = MARGIN;
    const drawHeader = () => {
      document.font('Unicode-Bold').fontSize(15).fillColor('#172033').text('HISTORIAL DE PAGOS', MARGIN, y, { width, align: 'left' });
      y += 20;
      const from = filtros.fechaDesde ? displayDate(filtros.fechaDesde) : '—';
      const to = filtros.fechaHasta ? displayDate(filtros.fechaHasta) : '—';
      document.font('Unicode').fontSize(8.5).fillColor('#374151').text(`Período: ${from}-${to}  |  Generado: ${civilNow()} (Costa Rica)`, MARGIN, y, { width });
      y += 13;
      const filterParts = [`Estado: ${friendlyStatus(filtros.estado)}`];
      if (filtros.buscar?.trim()) filterParts.push(`Búsqueda: ${filtros.buscar.trim()}`);
      if (filtros.prestamoId) filterParts.push(`Préstamo: #${filtros.prestamoId}`);
      if (filtros.formaPagoId) filterParts.push(`Forma: ${result.datos.find((pago) => pago.formaPagoId === filtros.formaPagoId)?.formaPago?.nombre ?? `ID ${filtros.formaPagoId}`}`);
      if (filtros.cobradorId) filterParts.push(`Cobrador: ${result.datos.find((pago) => pago.cobradorId === filtros.cobradorId)?.cobrador?.nombreCompleto ?? `ID ${filtros.cobradorId}`}`);
      document.text(filterParts.join('  |  '), MARGIN, y, { width });
      y += 14;
      const summary = [
        ['Pagos válidos', `${result.totales.cantidadPagos.toLocaleString('es-CR')} registrados`],
        ['Total recibido', crc(result.totales.totalRecibido)],
        ['Capital aplicado', crc(result.totales.capitalAplicado)],
        ['Interés aplicado', crc(result.totales.interesAplicado)],
      ];
      const blockWidth = width / summary.length;
      summary.forEach(([label, value], index) => {
        const x = MARGIN + index * blockWidth;
        document.rect(x, y, blockWidth - 4, 31).fill(index % 2 === 0 ? '#eef2f7' : '#e5eaf1');
        document.font('Unicode-Bold').fontSize(7.4).fillColor('#374151').text(label, x + 6, y + 5, { width: blockWidth - 16, align: 'center', lineBreak: false });
        document.font('Unicode-Bold').fontSize(9.2).fillColor('#172033').text(value, x + 6, y + 16, { width: blockWidth - 16, align: 'center', lineBreak: false });
      });
      y += 36;
      document.font('Unicode').fontSize(7.5).fillColor('#6b7280').text('Nota: los pagos ANULADO se muestran para auditoría, pero no representan dinero recibido ni participan en el resumen; los pagos REGISTRADO cuentan como pagos válidos y participan en los totales.', MARGIN, y, { width });
      y += 16;
    };
    const drawTableHeader = () => {
      const height = 19;
      document.rect(MARGIN, y, width, height).fill('#e5e7eb');
      let x = MARGIN;
      document.font('Unicode-Bold').fontSize(7.2).fillColor('#111827');
      columns.forEach((column) => { document.text(column.label, x + 3, y + 6, { width: column.width - 6, height: 10, ellipsis: true }); x += column.width; });
      y += height;
    };
    const rowValues = (pago: PagosExportacion['datos'][number]): string[] => {
      const cliente = pago.cliente?.nombreCompleto || '—';
      const identificacion = pago.cliente?.identificacion ? `ID ${pago.cliente.identificacion}` : 'ID —';
      return [displayDate(pago.fecha), `${cliente}\n${identificacion}`, `#${pago.prestamoId}`, pago.numeroPago == null ? '—' : String(pago.numeroPago), crc(pago.monto), crc(pago.capitalAplicado), crc(pago.interesAplicado), pago.formaPago?.nombre || '—', pago.cobrador?.nombreCompleto || '—', pago.estado || '—'];
    };
    const drawRow = (values: string[], rowIndex: number) => {
      const lineHeights = values.map((value, index) => document.heightOfString(value, { width: columns[index].width - 6, lineGap: 1 }));
      const height = Math.max(20, Math.min(42, Math.max(...lineHeights) + 7));
      if (y + height > PAGE_HEIGHT - MARGIN - 18) { document.addPage(); y = MARGIN; drawHeader(); drawTableHeader(); }
      if (rowIndex % 2 === 1) document.rect(MARGIN, y, width, height).fill('#f9fafb');
      let x = MARGIN;
      document.font('Unicode').fontSize(7).fillColor('#111827');
      values.forEach((value, index) => { document.text(value, x + 3, y + 4, { width: columns[index].width - 6, height: height - 6, lineGap: 1, ellipsis: true }); x += columns[index].width; });
      document.strokeColor('#d1d5db').moveTo(MARGIN, y + height).lineTo(MARGIN + width, y + height).stroke();
      y += height;
    };
    drawHeader();
    drawTableHeader();
    if (!result.datos.length) document.font('Unicode').fontSize(8).fillColor('#374151').text('No hay pagos que coincidan con los filtros seleccionados.', MARGIN + 4, y + 8, { width });
    result.datos.forEach((pago, index) => drawRow(rowValues(pago), index));
    const range = document.bufferedPageRange();
    for (let page = range.start; page < range.start + range.count; page += 1) {
      document.switchToPage(page);
      document.font('Unicode').fontSize(7).fillColor('#6b7280').text(`Página ${page - range.start + 1} de ${range.count}`, MARGIN, PAGE_HEIGHT - MARGIN + 2, { width, align: 'right' });
    }
  }
}
