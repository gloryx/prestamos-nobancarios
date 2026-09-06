import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { Cliente } from '../../domain/entities/cliente';
import { ClienteIdentificacionStorageService } from '../storage/cliente-identificacion-storage.service';

const POINTS_PER_MM = 72 / 25.4;
const PAGE_WIDTH = 108 * POINTS_PER_MM;
const PAGE_HEIGHT = 140 * POINTS_PER_MM;
const PAGE_MARGIN = 6 * POINTS_PER_MM;
const COMPACT_GAP = 0;
const BLANK_LINE_GAP = 4;
const VALUE_COLOR = '#243447';
const MUTED_COLOR = '#667085';
const ACCENT_COLOR = '#1f5f8b';

@Injectable()
export class ClienteFichaPdfService {
  constructor(private readonly identificationStorage: ClienteIdentificacionStorageService) {}

  async generate(cliente: Cliente): Promise<Buffer> {
    const [logo, footer, identification] = await Promise.all([
      fs.readFile(resolve(process.cwd(), 'assets', 'logo2.png')),
      fs.readFile(resolve(process.cwd(), 'assets', 'pie.png')),
      this.readIdentification(cliente.urlIdentificacion),
    ]);
    const [logoMetadata, footerMetadata] = await Promise.all([sharp(logo).metadata(), sharp(footer).metadata()]);
    const identificationSize = identification ? await this.imageSize(identification) : [undefined, undefined] as [number | undefined, number | undefined];
    const footerWidth = PAGE_WIDTH - PAGE_MARGIN * 2;
    const footerHeight = this.imageHeight(footerWidth, footerMetadata.width, footerMetadata.height);
    const footerTop = PAGE_HEIGHT - PAGE_MARGIN - footerHeight;

    const document = new PDFDocument({
      size: [PAGE_WIDTH, PAGE_HEIGHT],
      layout: 'portrait',
      margins: { top: PAGE_MARGIN, right: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN },
    });
    const chunks: Buffer[] = [];
    return new Promise<Buffer>((resolvePdf, reject) => {
      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.once('end', () => resolvePdf(Buffer.concat(chunks)));
      document.once('error', reject);

      const contentWidth = document.page.width - PAGE_MARGIN * 2;
      const logoHeight = this.imageHeight(contentWidth, logoMetadata.width, logoMetadata.height);
      document.image(logo, PAGE_MARGIN, PAGE_MARGIN, { width: contentWidth, height: logoHeight });
      document.y = PAGE_MARGIN + logoHeight + 3 * POINTS_PER_MM;
      document.fillColor(ACCENT_COLOR).font('Helvetica-Bold').fontSize(10).text('DATOS DEL CLIENTE', { width: contentWidth, align: 'center' });
      document.y += COMPACT_GAP;

      const columnGap = 3 * POINTS_PER_MM;
      const identificationWidth = 39 * POINTS_PER_MM;
      const leftWidth = contentWidth - columnGap - identificationWidth;
      const leftX = PAGE_MARGIN;
      const rightX = document.page.width - PAGE_MARGIN - identificationWidth;
      const columnsTop = document.y;
      document.font('Helvetica').fontSize(8).fillColor(VALUE_COLOR);

      document.x = leftX;
      document.y = columnsTop;
      this.field(document, 'Id cliente', String(cliente.id), leftWidth);
      this.field(document, 'Identificación', cliente.identificacion, leftWidth);
      this.field(document, 'Nombre', [cliente.primerNombre, cliente.segundoNombre, cliente.primerApellido, cliente.segundoApellido]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
        .join(' '), leftWidth, 7.4);
      this.field(document, 'Género', cliente.genero, leftWidth);
      this.field(document, 'Fecha de nacimiento', this.date(cliente.fechaNacimiento), leftWidth);
      const topLeftEnd = document.y;

      document.x = rightX;
      document.y = columnsTop;
      //document.fillColor(ACCENT_COLOR).font('Helvetica-Bold').fontSize(7.5).text('IDENTIFICACIÓN', { width: identificationWidth });
      document.y += COMPACT_GAP;
      if (identification) {
        const identificationHeight = this.imageHeight(identificationWidth, ...identificationSize);
        const visibleHeight = Math.min(identificationHeight, 35 * POINTS_PER_MM);
        document.image(identification, rightX, document.y, { fit: [identificationWidth, visibleHeight], align: 'center', valign: 'center' });
        document.y += visibleHeight + COMPACT_GAP;
      } else {
        const boxHeight = 10 * POINTS_PER_MM;
        document.rect(rightX, document.y, identificationWidth, boxHeight).strokeColor('#d0d5dd').lineWidth(0.6).stroke();
        document.fillColor(MUTED_COLOR).font('Helvetica-Oblique').fontSize(7).text('Sin imagen', rightX, document.y + (boxHeight - 7) / 2, { width: identificationWidth, align: 'center' });
        document.y += boxHeight + COMPACT_GAP;
      }
      const rightEnd = document.y;

      document.x = leftX;
      document.y = topLeftEnd;
      this.field(document, 'Teléfono 1', cliente.telefono1, leftWidth);
      this.field(document, 'Teléfono 2', cliente.telefono2, leftWidth);
      this.field(document, 'Correo', cliente.correo, leftWidth);
      this.field(document, 'Nacionalidad', cliente.nacionalidad, leftWidth);
      this.field(document, 'Fecha de ingreso', this.date(cliente.fechaIngreso), leftWidth);
      const detailsLeftEnd = document.y;

      document.x = PAGE_MARGIN;
      document.y = Math.max(detailsLeftEnd, rightEnd) + COMPACT_GAP;
      this.multilineField(document, 'Dirección', cliente.direccion, contentWidth);
      this.multilineField(document, 'Observaciones', cliente.observaciones, contentWidth);
      this.multilineField(document, 'Estado', cliente.activo ? 'ACTIVO' : 'INACTIVO', contentWidth);

      document.image(footer, PAGE_MARGIN, footerTop, { width: footerWidth, height: footerHeight });
      document.end();
    });
  }

  private imageHeight(width: number, sourceWidth?: number, sourceHeight?: number): number {
    return sourceWidth && sourceHeight ? width * sourceHeight / sourceWidth : 0;
  }

  private async imageSize(image: Buffer): Promise<[number | undefined, number | undefined]> {
    const metadata = await sharp(image).metadata();
    return [metadata.width, metadata.height];
  }

  private async readIdentification(url: string | null): Promise<Buffer | undefined> {
    try {
      const image = await this.identificationStorage.readImage(url);
      return image.mimetype === 'image/webp' ? sharp(image.buffer).png().toBuffer() : image.buffer;
    } catch (error) {
      if (error instanceof NotFoundException) return undefined;
      throw error;
    }
  }

  private field(document: PDFKit.PDFDocument, label: string, value: string | null | undefined, width: number, valueFontSize = 7.2): void {
    this.inlineField(document, label, value, width, MUTED_COLOR, 7, valueFontSize);
  }

  private multilineField(document: PDFKit.PDFDocument, label: string, value: string | null | undefined, width: number): void {
    this.inlineField(document, label, value, width, ACCENT_COLOR, 7, 6.9);
  }

  private inlineField(document: PDFKit.PDFDocument, label: string, value: string | null | undefined, width: number, labelColor = MUTED_COLOR, labelFontSize = 7, valueFontSize = 7.2): void {
    const textValue = value?.trim() || '-';
    document.fillColor(labelColor).font('Helvetica-Bold').fontSize(labelFontSize).text(`${label}: `, { width, continued: true });
    document.fillColor(VALUE_COLOR).font('Helvetica').fontSize(valueFontSize).text(textValue, { width, lineGap: 0 });
    document.y += BLANK_LINE_GAP;
  }

  private date(value: Date | null): string | null {
    return value ? value.toLocaleDateString('es-CR') : null;
  }
}
