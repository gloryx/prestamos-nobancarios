import { jsPDF } from 'jspdf'
import { autoTable, type UserOptions } from 'jspdf-autotable'
import type { AnalisisFinancieroResponse, Cliente } from '../domain/cliente.types'
import { formatCRC } from '@/shared/utils/currency'
import notoSansRegularUrl from './fonts/NotoSans-Regular.ttf?inline'
import notoSansBoldUrl from './fonts/NotoSans-Bold.ttf?inline'

const totalPagesToken = '___total_pages___'
const pdfFontFamily = 'NotoSans'

const registerPdfFonts = (doc: jsPDF) => {
  doc.addFileToVFS('NotoSans-Regular.ttf', notoSansRegularUrl.split(',')[1])
  doc.addFileToVFS('NotoSans-Bold.ttf', notoSansBoldUrl.split(',')[1])
  doc.addFont('NotoSans-Regular.ttf', pdfFontFamily, 'normal')
  doc.addFont('NotoSans-Bold.ttf', pdfFontFamily, 'bold')
  doc.setFont(pdfFontFamily, 'normal')
}

const clienteNombre = (cliente: Cliente) => [cliente.primerNombre, cliente.segundoNombre, cliente.primerApellido, cliente.segundoApellido].filter(Boolean).join(' ')

const dateLabel = (value: string | null | undefined) => value ? value.slice(0, 10).split('-').reverse().join('/') : '—'

const dateTimeLabel = (value: Date) => {
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()} ${pad(value.getHours())}:${pad(value.getMinutes())}`
}

const fileDate = (value: Date) => {
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

const safeFilePart = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase() || 'cliente'

export function generarAnalisisFinancieroClientePdf(analysis: AnalisisFinancieroResponse, cliente: Cliente): void {
  const generatedAt = new Date()
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 10
  const name = clienteNombre(cliente)

  registerPdfFonts(doc)
  doc.setProperties({ title: 'Análisis financiero del cliente', subject: 'Préstamos No Bancarios' })
  doc.setTextColor(16, 42, 67)
  doc.setFont(pdfFontFamily, 'bold')
  doc.setFontSize(13)
  doc.text('PRÉSTAMOS NO BANCARIOS', margin, 12)
  doc.setFontSize(11)
  doc.text('ANÁLISIS FINANCIERO DEL CLIENTE', margin, 18)
  doc.setFont(pdfFontFamily, 'normal')
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  doc.text(`Cliente: ${name}`, margin, 25)
  doc.text(`Identificación: ${cliente.identificacion}`, margin, 30)
  const phones = [cliente.telefono1, cliente.telefono2].filter(Boolean).join(' · ')
  doc.text(`Teléfonos: ${phones || '—'}`, margin, 35)
  doc.text(`Generado: ${dateTimeLabel(generatedAt)}`, pageWidth - margin, 25, { align: 'right' })

  const summary = [
    ['Total prestado', formatCRC(analysis.resumen.totalPrestado)],
    ['Total pagado', formatCRC(analysis.resumen.totalPagado)],
    ['Pendiente', formatCRC(analysis.resumen.pendiente)],
    ['Ganancia cobrada', formatCRC(analysis.resumen.ganancia)],
    ['Préstamos', String(analysis.resumen.cantidadPrestamos)],
  ]
  const summaryWidth = (pageWidth - margin * 2 - 8) / summary.length
  summary.forEach(([label, value], index) => {
    const x = margin + index * (summaryWidth + 2)
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(x, 39, summaryWidth, 13, 1, 1, 'F')
    doc.setFontSize(7)
    doc.setTextColor(82, 102, 122)
    doc.text(label, x + 2, 44)
    doc.setFont(pdfFontFamily, 'bold')
    doc.setFontSize(8)
    doc.setTextColor(16, 42, 67)
    doc.text(value, x + 2, 49)
    doc.setFont(pdfFontFamily, 'normal')
  })

  const tableOptions: UserOptions = {
    startY: 57,
    margin: { left: margin, right: margin, bottom: 15 },
    theme: 'grid',
    head: [['PRÉSTAMO', 'ESTADO', 'COBRANZA', 'CAPITAL', 'PAGADO', 'PENDIENTE', 'GANANCIA', 'ÚLTIMO PAGO', 'DURACIÓN']],
    body: analysis.prestamos.map((prestamo) => [
      `#${prestamo.id}`,
      prestamo.estado,
      prestamo.indicadorCobranza === 'AL_DIA' ? 'Al día' : prestamo.indicadorCobranza === 'ATRASADO' ? 'Atrasado' : prestamo.indicadorCobranza === 'PLAZO_CUMPLIDO' ? 'Plazo cumplido' : 'Saldado',
      formatCRC(prestamo.capital),
      formatCRC(prestamo.totalPagado),
      formatCRC(prestamo.saldoPendiente),
      formatCRC(prestamo.interesPagado),
      prestamo.ultimoPago ? `${dateLabel(prestamo.ultimoPago.fecha)} · ${formatCRC(prestamo.ultimoPago.monto)}` : 'Sin pagos',
      prestamo.duracionDias === null || prestamo.duracionDias === undefined ? '—' : `${prestamo.duracionDias} días`,
    ]),
    styles: { font: pdfFontFamily, fontSize: 7, cellPadding: 1.8, overflow: 'linebreak', valign: 'middle', minCellHeight: 7 },
    bodyStyles: { font: pdfFontFamily, fontStyle: 'normal' },
    headStyles: { fillColor: [16, 42, 67], textColor: 255, fontStyle: 'bold', fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 20 }, 1: { cellWidth: 25 }, 2: { cellWidth: 29 },
      3: { cellWidth: 29, halign: 'right' }, 4: { cellWidth: 29, halign: 'right' },
      5: { cellWidth: 29, halign: 'right' }, 6: { cellWidth: 29, halign: 'right' },
      7: { cellWidth: 47 }, 8: { cellWidth: 25, halign: 'center' },
    },
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    didDrawPage: ({ pageNumber }) => {
      doc.setDrawColor(203, 213, 225)
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)
      doc.setFont(pdfFontFamily, 'normal')
      doc.setFontSize(7)
      doc.setTextColor(100, 116, 139)
      doc.text('Documento generado por Préstamos No Bancarios', margin, pageHeight - 7)
      doc.text(`Página ${pageNumber} de ${totalPagesToken}`, pageWidth - margin, pageHeight - 7, { align: 'right' })
    },
  }

  autoTable(doc, tableOptions)
  const pdfWithTotalPages = doc as jsPDF & { putTotalPages?: (pageExpression: string) => void }
  pdfWithTotalPages.putTotalPages?.(totalPagesToken)
  doc.save(`analisis-financiero-${safeFilePart(name)}-${fileDate(generatedAt)}.pdf`)
}
