import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { formatCRC } from '@/shared/utils/currency'
import type { FormaPagoReport } from '../domain/forma-pago-report.types'

const dateLabel = (value: string) => { const [year, month, day] = value.split('-'); return `${day}/${month}/${year}` }
const generatedLabel = () => new Intl.DateTimeFormat('es-CR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())

export function generarReporteFormaPagoPdf(report: FormaPagoReport): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const width = doc.internal.pageSize.getWidth()
  doc.setProperties({ title: 'Reporte por forma de pago', subject: 'Préstamos No Bancarios' })
  doc.setTextColor(16, 42, 67); doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text('PRÉSTAMOS NO BANCARIOS', 10, 12)
  doc.setFontSize(11); doc.text('REPORTE POR FORMA DE PAGO', 10, 19)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(71, 85, 105); doc.text(`Período: ${dateLabel(report.fechaDesde)} al ${dateLabel(report.fechaHasta)}`, 10, 25); doc.text(`Generado: ${generatedLabel()}`, width - 10, 25, { align: 'right' })
  autoTable(doc, { startY: 30, margin: { left: 10, right: 10 }, theme: 'grid', head: [['Resumen', 'Monto']], body: [['Total desembolsado', formatCRC(report.resumen.totalDesembolsado)], ['Total recibido', formatCRC(report.resumen.totalRecibido)], ['Diferencia', formatCRC(report.resumen.diferencia)]], headStyles: { fillColor: [16, 42, 67] }, styles: { fontSize: 8 }, columnStyles: { 1: { halign: 'right' } } })
  const summaryEnd = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 55
  autoTable(doc, { startY: summaryEnd + 7, margin: { left: 10, right: 152 }, theme: 'grid', head: [['Forma', 'Cantidad', 'Monto']], body: [...report.desembolsos.map((row) => [row.formaPagoNombre, row.cantidad, formatCRC(row.monto)]), ['TOTAL', report.desembolsos.reduce((sum, row) => sum + row.cantidad, 0), formatCRC(report.resumen.totalDesembolsado)]], headStyles: { fillColor: [39, 102, 120] }, didParseCell: (data) => { if (data.row.index === report.desembolsos.length) data.cell.styles.fontStyle = 'bold' }, styles: { fontSize: 8 }, columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } } })
  autoTable(doc, { startY: summaryEnd + 7, margin: { left: 152, right: 10 }, theme: 'grid', head: [['Forma', 'Cantidad', 'Monto']], body: [...report.pagos.map((row) => [row.formaPagoNombre, row.cantidad, formatCRC(row.monto)]), ['TOTAL', report.pagos.reduce((sum, row) => sum + row.cantidad, 0), formatCRC(report.resumen.totalRecibido)]], headStyles: { fillColor: [42, 157, 143] }, didParseCell: (data) => { if (data.row.index === report.pagos.length) data.cell.styles.fontStyle = 'bold' }, styles: { fontSize: 8 }, columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } } })
  doc.setFontSize(7); doc.setTextColor(100, 116, 139); doc.text('Reporte generado por Préstamos No Bancarios', 10, 202)
  if (report.resumen.movimientosDesembolsoSinForma > 0) doc.text(`Advertencia: ${report.resumen.movimientosDesembolsoSinForma} desembolso(s) sin forma de pago clasificada.`, 10, 197)
  doc.save(`reporte-forma-pago-${report.fechaDesde}-${report.fechaHasta}.pdf`)
}
