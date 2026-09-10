import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { promises as fs } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Cliente } from '../../../clientes/domain/entities/cliente';
import { PlanPago } from '../../../planes-pago/domain/entities/plan-pago';
import { PrestamoConRelaciones } from '../../domain/repositories/prestamo.repository';
import { EstadoPrestamo } from '../../domain/enums/estado-prestamo.enum';
type Applied = Map<number, { total: number; fechas: string[] }>;

const PAGE_WIDTH = 400;
const MARGIN = 10;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const ROW_HEIGHT = 14;
const BOTTOM_GAP = MARGIN;
const FIRST_ROW_Y = 195;

const date = (value: Date): string => `${String(value.getUTCDate()).padStart(2, '0')}/${String(value.getUTCMonth() + 1).padStart(2, '0')}/${value.getUTCFullYear()}`;
const money = (value: number): string => `₡ ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)}`;
const fullName = (cliente: Cliente): string => [cliente.primerNombre, cliente.segundoNombre, cliente.primerApellido, cliente.segundoApellido].filter((value): value is string => Boolean(value?.trim())).join(' ');

export const drawRefinancedWatermark = (document: InstanceType<typeof PDFDocument>): void => {
  const page = document.page;
  document.save();
  document.rotate(-35, { origin: [page.width / 2, page.height / 2] });
  document.opacity(0.20).fillColor('#6b7280').font('Helvetica-Bold').fontSize(48).text('REFINANCIADO', 0, page.height / 2 - 24, { width: page.width, align: 'center', lineBreak: false });
  document.restore();
};

export const drawRefinancedWatermarks = (document: InstanceType<typeof PDFDocument>): void => {
  const range = document.bufferedPageRange();
  for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
    document.switchToPage(pageIndex);
    drawRefinancedWatermark(document);
  }
};

const existingPath = async (candidates: string[]): Promise<string> => {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next known location.
    }
  }
  throw new Error(`No Unicode TTF font found. Tried: ${candidates.join(', ')}`);
};

@Injectable()
export class PlanPagoPdfInfrastructureService {
  async generate(prestamo: PrestamoConRelaciones, cliente: Cliente, plan: PlanPago[], applied?: Applied): Promise<Buffer> {
    const assets = resolve(process.cwd(), 'assets');
    const moduleAssets = resolve(dirname(__filename), '../../../../../assets');
    const logo = await fs.readFile(resolve(assets, 'logo1.png'));
    const font = await existingPath([
      resolve(assets, 'DejaVuSans.ttf'),
      resolve(assets, 'NotoSans-Regular.ttf'),
      resolve(moduleAssets, 'DejaVuSans.ttf'),
      resolve(moduleAssets, 'NotoSans-Regular.ttf'),
      'C:\\Windows\\Fonts\\arial.ttf',
      'C:\\Windows\\Fonts\\segoeui.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
    ]);

     const pageHeight = FIRST_ROW_Y + plan.length * ROW_HEIGHT + BOTTOM_GAP;
      const document = new PDFDocument({ bufferPages: true, size: [PAGE_WIDTH, pageHeight], margins: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } });
     document.registerFont('Unicode', font);
     const chunks: Buffer[] = [];

    return new Promise<Buffer>((resolvePdf, reject) => {
      document.on('data', (chunk: Buffer) => chunks.push(chunk));
       document.once('end', () => resolvePdf(Buffer.concat(chunks)));
       document.once('error', reject);

        const text = (value: string, x: number, y: number, width: number, size: number, color = '#243447', options: Record<string, unknown> = {}, font = 'Unicode'): void => {
         document.font(font).fontSize(size).fillColor(color).text(value || '-', x, y, { width, lineGap: 0, paragraphGap: 0, ...options });
      };
       const field = (label: string, value: string, x: number, y: number, width: number, size = 8): void => {
        text(`${label} ${value || '-'}`, x, y, width, size);
      };
       const header = (): void => {
           document.image(logo, MARGIN, MARGIN, { fit: [CONTENT_WIDTH, 22], align: 'center' });
           const y = MARGIN + 24;
           text(applied ? 'ESTADO DE CUENTA' : 'PLAN DE PAGO', MARGIN, y, CONTENT_WIDTH, 12, '#1f5f8b', { align: 'center' });
          text(`Préstamo #${prestamo.id}`, MARGIN, y + 13, CONTENT_WIDTH, 8, '#243447', { align: 'center' });
       };
       const tableHeader = (y: number): number => {
          document.rect(MARGIN, y, CONTENT_WIDTH, 15).fill('#1f5f8b');
          text('No.', MARGIN + 2, y + 3, 25, 8, '#ffffff');
          text('Fecha', MARGIN + 27, y + 3, 65, 8, '#ffffff');
          text('Cuota', MARGIN + 92, y + 3, applied ? 68 : 212, 8, '#ffffff', { align: 'right' });
          if (applied) {
            text('Pagado', MARGIN + 160, y + 3, 68, 8, '#ffffff', { align: 'right' });
            text('Pendiente', MARGIN + 228, y + 3, 76, 8, '#ffffff', { align: 'right' });
          }
          text('Estado', MARGIN + 304, y + 3, 76, 8, '#ffffff', { align: 'center', lineBreak: false });
          return y + 16;
       };
       const renderRow = (cuota: PlanPago, index: number, y: number): number => {
         if (index % 2 === 0) document.rect(MARGIN, y - 1, CONTENT_WIDTH, ROW_HEIGHT).fill('#f5f7fa');
         document.moveTo(MARGIN, y + ROW_HEIGHT - 1).lineTo(MARGIN + CONTENT_WIDTH, y + ROW_HEIGHT - 1).strokeColor('#d9e0e7').lineWidth(0.35).stroke();
          text(String(cuota.numeroPago), MARGIN + 2, y + 2, 25, 8);
          text(date(cuota.fechaVencimiento), MARGIN + 27, y + 2, 65, 8);
           const total = applied?.get(cuota.id!)?.total ?? 0; const pending = Math.max(0, cuota.montoProgramado - total); const status = total <= 0 ? 'Pendiente' : pending <= 0 ? 'Pagada' : 'Parcial';
           text(money(cuota.montoProgramado), MARGIN + 92, y + 2, applied ? 68 : 212, 8, '#243447', { align: 'right' });
           if (applied) { text(money(total), MARGIN + 160, y + 2, 68, 8, '#243447', { align: 'right' }); text(money(pending), MARGIN + 228, y + 2, 76, 8, '#243447', { align: 'right' }); }
            const statusColor = status === 'Pagada' ? '#15803D' : status === 'Pendiente' ? '#DC2626' : '#243447';
            const statusFont = status === 'Pagada' || status === 'Pendiente' ? 'Helvetica-Bold' : 'Unicode';
            text(status.toUpperCase(), MARGIN + 304, y + 2, 76, 8, statusColor, { align: 'center', lineBreak: false }, statusFont);
         return y + ROW_HEIGHT;
       };

      header();
       let y = 61;
        text('Cliente', MARGIN, y, CONTENT_WIDTH, 9, '#1f5f8b');
        y += 11;
        field('Nombre:', fullName(cliente), MARGIN, y, CONTENT_WIDTH, 8.5); y += 12;
        field('Identificación:', cliente.identificacion, MARGIN, y, 190); field('Teléfono:', cliente.telefono1, MARGIN + 200, y, 180); y += 12;
        field('Fecha de alta:', date(prestamo.fechaAlta), MARGIN, y, 190); field('Periodicidad:', prestamo.periodicidadPago.nombre, MARGIN + 200, y, 180); y += 12;
        field('Forma de pago:', prestamo.formaPago.nombre, MARGIN, y, CONTENT_WIDTH); y += 14;
        text('Resumen', MARGIN, y, CONTENT_WIDTH, 9, '#1f5f8b'); y += 11;
        field('Capital:', money(prestamo.capital), MARGIN, y, 190); field('Interés:', money(prestamo.interes), MARGIN + 200, y, 180); y += 12;
         field('Total a pagar:', money(prestamo.montoTotal), MARGIN, y, 190); field('Pagos:', String(prestamo.cantidadPagos), MARGIN + 200, y, 180); y += 12;
         if (applied) { const paid = plan.reduce((sum, cuota) => sum + (applied.get(cuota.id!)?.total ?? 0), 0); field('Monto pagado:', money(paid), MARGIN, y, 190); field('Saldo pendiente:', money(Math.max(0, prestamo.montoTotal - paid)), MARGIN + 200, y, 180); y += 14; } else y += 2;
        text('Detalle de cuotas', MARGIN, y, CONTENT_WIDTH, 9, '#1f5f8b'); y = tableHeader(y + 10);

       plan.forEach((cuota, index) => { y = renderRow(cuota, index, y); });
       if (prestamo.estado === EstadoPrestamo.REFINANCIADO) drawRefinancedWatermarks(document);
       document.end();
    });
  }
}
