import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DesempenoCobradoresReport } from '../application/desempeno-cobradores.use-case';
import type { DesempenoCobradoresQueryDto } from '../application/dto/desempeno-cobradores-query.dto';

const MM = 72 / 25.4;
const MARGIN = 11 * MM;
const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const FOOTER_HEIGHT = 10;
const FOOTER_Y = PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT;
const FONT_DIRECTORY = resolve(__dirname, '../../pagos/infrastructure/pdf/fonts');
const FONT_REGULAR = resolve(FONT_DIRECTORY, 'NotoSans-Regular.ttf');
const FONT_BOLD = resolve(FONT_DIRECTORY, 'NotoSans-Bold.ttf');
const CR_TIME_ZONE = 'America/Costa_Rica';

const money = (value: number): string => `₡${(Number(value) || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (value: string): string => `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
const nowInCostaRica = (): string => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: CR_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.day}/${values.month}/${values.year} ${values.hour}:${values.minute}`;
};

@Injectable()
export class DesempenoCobradoresPdfService {
  generar(report: DesempenoCobradoresReport, query: DesempenoCobradoresQueryDto): Promise<Buffer> {
    const document = new PDFDocument({ size: 'A4', layout: 'landscape', margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN }, bufferPages: true, info: { Title: 'Desempeño de cobradores' } });
    const chunks: Buffer[] = [];
    return new Promise((resolvePromise, reject) => {
      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.on('end', () => resolvePromise(Buffer.concat(chunks)));
      document.on('error', reject);
      this.render(document, report, query);
      document.end();
    });
  }

  private render(document: PDFKit.PDFDocument, report: DesempenoCobradoresReport, query: DesempenoCobradoresQueryDto): void {
    if (!existsSync(FONT_REGULAR) || !existsSync(FONT_BOLD)) throw new Error(`Unicode PDF fonts are not available at ${FONT_DIRECTORY}`);
    document.registerFont('Unicode', FONT_REGULAR);
    document.registerFont('Unicode-Bold', FONT_BOLD);
    const width = PAGE_WIDTH - MARGIN * 2;
    const columns = [
      { label: 'Cobrador', width: 134 }, { label: 'Pagos', width: 48 }, { label: 'Monto recibido', width: 91 },
      { label: 'Capital', width: 84 }, { label: 'Interés', width: 80 }, { label: 'Clientes', width: 55 },
      { label: 'Préstamos', width: 62 }, { label: 'Promedio/pago', width: 91 }, { label: 'Participación', width: 82 },
    ];
    const scale = width / columns.reduce((sum, column) => sum + column.width, 0);
    columns.forEach((column) => { column.width *= scale; });
    let y = MARGIN;
    const drawHeader = () => {
      document.font('Unicode-Bold').fontSize(15).fillColor('#172033').text('DESEMPEÑO DE COBRADORES', MARGIN, y, { width }); y += 20;
      document.font('Unicode').fontSize(8.5).fillColor('#374151').text(`Período: ${date(query.fechaDesde)} - ${date(query.fechaHasta)}  |  Generado: ${nowInCostaRica()} (Costa Rica)`, MARGIN, y, { width }); y += 13;
      const filters = [`Cobrador: ${query.cobradorId ? `ID ${query.cobradorId}` : 'Todos'}`, `Forma de pago: ${query.formaPagoId ? `ID ${query.formaPagoId}` : 'Todas'}`];
      document.text(filters.join('  |  '), MARGIN, y, { width }); y += 14;
      const blocks = [
        ['Pagos registrados', report.totales.cantidadPagos.toLocaleString('es-CR')],
        ['Total recibido', money(report.totales.totalRecibido)],
        ['Capital aplicado', money(report.totales.capitalAplicado)],
        ['Interés aplicado', money(report.totales.interesAplicado)],
      ];
      const blockWidth = width / blocks.length;
      blocks.forEach(([label, value], index) => { const x = MARGIN + index * blockWidth; document.rect(x, y, blockWidth - 4, 31).fill(index % 2 === 0 ? '#eef2f7' : '#e5eaf1'); document.font('Unicode-Bold').fontSize(7.4).fillColor('#374151').text(label, x + 6, y + 5, { width: blockWidth - 16, align: 'center', lineBreak: false }); document.font('Unicode-Bold').fontSize(9.2).fillColor('#172033').text(value, x + 6, y + 16, { width: blockWidth - 16, align: 'center', lineBreak: false }); });
      y += 36;
      document.font('Unicode').fontSize(7.5).fillColor('#6b7280').text(`Cobradores con pagos: ${report.totales.cantidadCobradores.toLocaleString('es-CR')}. Nota: los datos representan pagos REGISTRADO dentro del período y la forma de pago seleccionados; clientes y préstamos son cantidades distintas, no sumas de filas.`, MARGIN, y, { width }); y += 17;
    };
    const drawTableHeader = () => { const height = 19; document.rect(MARGIN, y, width, height).fill('#e5e7eb'); let x = MARGIN; document.font('Unicode-Bold').fontSize(7.1).fillColor('#111827'); columns.forEach((column) => { document.text(column.label, x + 3, y + 6, { width: column.width - 6, height: 10, ellipsis: true }); x += column.width; }); y += height; };
    const values = (row: DesempenoCobradoresReport['cobradores'][number]): string[] => [row.cobradorNombre, row.cantidadPagos.toLocaleString('es-CR'), money(row.montoRecibido), money(row.capitalAplicado), money(row.interesAplicado), row.cantidadClientes.toLocaleString('es-CR'), row.cantidadPrestamos.toLocaleString('es-CR'), money(row.promedioPorPago), row.participacionMonto > 0 ? `${row.participacionMonto.toFixed(2)}%` : '—'];
    const drawRow = (rowValues: string[], index: number) => { const height = 22; if (y + height > PAGE_HEIGHT - MARGIN - 18) { document.addPage(); y = MARGIN; drawHeader(); drawTableHeader(); } if (index % 2 === 1) document.rect(MARGIN, y, width, height).fill('#f9fafb'); let x = MARGIN; document.font('Unicode').fontSize(7).fillColor('#111827'); rowValues.forEach((value, cell) => { document.text(value, x + 3, y + 6, { width: columns[cell].width - 6, height: 11, ellipsis: true, align: cell >= 1 ? 'right' : 'left' }); x += columns[cell].width; }); document.strokeColor('#d1d5db').moveTo(MARGIN, y + height).lineTo(MARGIN + width, y + height).stroke(); y += height; };
    const drawTotal = () => { if (y + 23 > PAGE_HEIGHT - MARGIN - 18) { document.addPage(); y = MARGIN; drawHeader(); drawTableHeader(); } const total: string[] = ['TOTAL', report.totales.cantidadPagos.toLocaleString('es-CR'), money(report.totales.totalRecibido), money(report.totales.capitalAplicado), money(report.totales.interesAplicado), '—', '—', '—', report.totales.totalRecibido > 0 ? '100.00%' : '—']; document.rect(MARGIN, y, width, 23).fill('#dbe5ed'); let x = MARGIN; document.font('Unicode-Bold').fontSize(7).fillColor('#172033'); total.forEach((value, cell) => { document.text(value, x + 3, y + 7, { width: columns[cell].width - 6, height: 11, align: cell >= 1 ? 'right' : 'left', ellipsis: true }); x += columns[cell].width; }); y += 23; };
    drawHeader(); drawTableHeader();
    if (!report.cobradores.length) document.font('Unicode').fontSize(8).fillColor('#374151').text('No hay pagos registrados para los filtros seleccionados.', MARGIN + 4, y + 8, { width });
    report.cobradores.forEach((row, index) => drawRow(values(row), index));
    if (report.cobradores.length) drawTotal();
    const range = document.bufferedPageRange();
    for (let page = range.start; page < range.start + range.count; page += 1) { document.switchToPage(page); document.font('Unicode').fontSize(7).fillColor('#6b7280').text(`Página ${page - range.start + 1} de ${range.count}`, MARGIN, FOOTER_Y, { width, height: FOOTER_HEIGHT, align: 'right', lineBreak: false }); }
  }
}
