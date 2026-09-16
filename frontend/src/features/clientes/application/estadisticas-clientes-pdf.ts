import { jsPDF } from 'jspdf'
import { autoTable, type UserOptions } from 'jspdf-autotable'
import { formatCRC } from '@/shared/utils/currency'
import type { EstadisticasClientesOrden, EstadisticasClientesResponse } from '../domain/estadisticas-clientes.types'
import notoSansRegularUrl from './fonts/NotoSans-Regular.ttf?inline'
import notoSansBoldUrl from './fonts/NotoSans-Bold.ttf?inline'

const font = 'NotoSans'
const pagesToken = '___total_pages___'
const titles: Record<EstadisticasClientesOrden, string> = { cantidadPrestamos: 'CANTIDAD DE PRÉSTAMOS', totalPrestado: 'TOTAL PRESTADO', gananciaCobrada: 'GANANCIA COBRADA' }
const registerFonts = (doc: jsPDF) => {
  doc.addFileToVFS('NotoSans-Regular.ttf', notoSansRegularUrl.split(',')[1])
  doc.addFileToVFS('NotoSans-Bold.ttf', notoSansBoldUrl.split(',')[1])
  doc.addFont('NotoSans-Regular.ttf', font, 'normal')
  doc.addFont('NotoSans-Bold.ttf', font, 'bold')
  doc.setFont(font, 'normal')
}
const dateLabel = (date: Date) => `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`

export function generarEstadisticasClientesPdf(response: EstadisticasClientesResponse): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()
  registerFonts(doc)
  doc.setProperties({ title: `Estadísticas de clientes — ${titles[response.orden]}`, subject: 'Préstamos No Bancarios' })
  doc.setTextColor(16, 42, 67)
  doc.setFont(font, 'bold'); doc.setFontSize(13); doc.text('PRÉSTAMOS NO BANCARIOS', 10, 12)
  doc.setFontSize(11); doc.text(`ESTADÍSTICAS DE CLIENTES — ${titles[response.orden]}`, 10, 18)
  doc.setFont(font, 'normal'); doc.setFontSize(8); doc.setTextColor(71, 85, 105); doc.text(`Generado: ${dateLabel(new Date())}`, width - 10, 18, { align: 'right' })
  const options: UserOptions = {
    startY: 24, margin: { left: 10, right: 10, bottom: 15 }, theme: 'grid', showHead: 'everyPage', rowPageBreak: 'avoid',
    head: [['#', 'Cliente', 'Identificación', 'Préstamos', 'Total prestado', 'Ganancia cobrada', 'Antigüedad']],
    body: response.datos.map((row) => [String(row.posicion), row.cliente, row.identificacion, String(row.cantidadPrestamos), formatCRC(row.totalPrestado), formatCRC(row.gananciaCobrada), row.antiguedad]),
    styles: { font, fontSize: 7, cellPadding: 1.8, overflow: 'linebreak', valign: 'middle' },
    headStyles: { fillColor: [16, 42, 67], textColor: 255, fontStyle: 'bold', fontSize: 7 },
    columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 58 }, 2: { cellWidth: 34 }, 3: { cellWidth: 24, halign: 'right' }, 4: { cellWidth: 35, halign: 'right' }, 5: { cellWidth: 35, halign: 'right' }, 6: { cellWidth: 31, halign: 'center' } },
    didDrawPage: ({ pageNumber }) => { doc.setDrawColor(203, 213, 225); doc.line(10, height - 12, width - 10, height - 12); doc.setFont(font, 'normal'); doc.setFontSize(7); doc.setTextColor(100, 116, 139); doc.text('Reporte generado por Préstamos No Bancarios', 10, height - 7); doc.text(`Página ${pageNumber} de ${pagesToken}`, width - 10, height - 7, { align: 'right' }) },
  }
  autoTable(doc, options)
  ;(doc as jsPDF & { putTotalPages?: (token: string) => void }).putTotalPages?.(pagesToken)
  doc.save(`estadisticas-clientes-${response.orden}-${new Date().toISOString().slice(0, 10)}.pdf`)
}
