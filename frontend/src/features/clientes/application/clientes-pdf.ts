import { jsPDF } from 'jspdf'
import { autoTable, type UserOptions } from 'jspdf-autotable'
import type { Cliente } from '../domain/cliente.types'
import notoSansRegularUrl from './fonts/NotoSans-Regular.ttf?inline'
import notoSansBoldUrl from './fonts/NotoSans-Bold.ttf?inline'

const font = 'NotoSans'
const totalPagesToken = '___total_pages___'
const missingValue = '—'

const registerFonts = (doc: jsPDF) => {
  doc.addFileToVFS('NotoSans-Regular.ttf', notoSansRegularUrl.split(',')[1])
  doc.addFileToVFS('NotoSans-Bold.ttf', notoSansBoldUrl.split(',')[1])
  doc.addFont('NotoSans-Regular.ttf', font, 'normal')
  doc.addFont('NotoSans-Bold.ttf', font, 'bold')
  doc.setFont(font, 'normal')
}

const safeValue = (value: string | null | undefined) => value?.trim() || missingValue
const clienteNombre = (cliente: Cliente) => [cliente.primerNombre, cliente.segundoNombre, cliente.primerApellido, cliente.segundoApellido]
  .map((value) => value?.trim())
  .filter(Boolean)
  .join(' ') || missingValue
const safeAddress = (value: string | null | undefined) => safeValue(value)?.replace(/\r\n?/g, '\n') ?? missingValue
const dateTimeLabel = (value: Date) => {
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()} ${pad(value.getHours())}:${pad(value.getMinutes())}`
}
const fileDate = (value: Date) => {
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

export function generarClientesPdf(clientes: Cliente[]): void {
  if (!clientes.length) throw new Error('No hay clientes para exportar.')
  const generatedAt = new Date()
  const orderedClients = [...clientes].sort((left, right) => {
    const byName = clienteNombre(left).localeCompare(clienteNombre(right), 'es', { sensitivity: 'base' })
    return byName || safeValue(left.identificacion).localeCompare(safeValue(right.identificacion), 'es', { sensitivity: 'base' })
  })
  const active = orderedClients.filter((cliente) => cliente.activo).length
  const inactive = orderedClients.length - active
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 10

  registerFonts(doc)
  doc.setProperties({ title: 'Listado general de clientes', subject: 'Préstamos No Bancarios' })
  doc.setTextColor(16, 42, 67)
  doc.setFont(font, 'bold')
  doc.setFontSize(13)
  doc.text('PRÉSTAMOS NO BANCARIOS', margin, 12)
  doc.setFontSize(11)
  doc.text('LISTADO GENERAL DE CLIENTES', margin, 18)
  doc.setFont(font, 'normal')
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  doc.text(`Generado: ${dateTimeLabel(generatedAt)}`, pageWidth - margin, 18, { align: 'right' })
  doc.text(`Total: ${orderedClients.length} · Activos: ${active} · Inactivos: ${inactive}`, margin, 25)

  const options: UserOptions = {
    startY: 30,
    margin: { left: margin, right: margin, bottom: 15 },
    theme: 'grid',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    head: [['N.º', 'IDENTIFICACIÓN', 'NOMBRE COMPLETO', 'TELÉFONO PRINCIPAL', 'TELÉFONO SECUNDARIO', 'DIRECCIÓN', 'ESTADO']],
    body: orderedClients.map((cliente, index) => [
      String(index + 1),
      safeValue(cliente.identificacion),
      clienteNombre(cliente),
      safeValue(cliente.telefono1),
      safeValue(cliente.telefono2),
      safeAddress(cliente.direccion),
      cliente.activo ? 'Activo' : 'Inactivo',
    ]),
    styles: { font, fontSize: 7, cellPadding: 1.8, overflow: 'linebreak', valign: 'middle' },
    headStyles: { fillColor: [16, 42, 67], textColor: 255, fontStyle: 'bold', fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
      1: { cellWidth: 30 },
      2: { cellWidth: 57 },
      3: { cellWidth: 28 },
      4: { cellWidth: 28 },
      5: { cellWidth: 93 },
      6: { cellWidth: 27, halign: 'center' },
    },
    didDrawPage: ({ pageNumber }) => {
      doc.setDrawColor(203, 213, 225)
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)
      doc.setFont(font, 'normal')
      doc.setFontSize(7)
      doc.setTextColor(100, 116, 139)
      doc.text('Reporte generado por Préstamos No Bancarios', margin, pageHeight - 7)
      doc.text(`Página ${pageNumber} de ${totalPagesToken}`, pageWidth - margin, pageHeight - 7, { align: 'right' })
    },
  }

  autoTable(doc, options)
  ;(doc as jsPDF & { putTotalPages?: (token: string) => void }).putTotalPages?.(totalPagesToken)
  doc.save(`Clientes_General_${fileDate(generatedAt)}.pdf`)
}
