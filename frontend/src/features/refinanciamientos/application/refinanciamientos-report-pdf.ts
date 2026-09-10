import { jsPDF } from 'jspdf'
import { autoTable, type UserOptions } from 'jspdf-autotable'
import { formatCRC } from '@/shared/utils/currency'
import type { RefinanciamientoReportFilters, RefinanciamientoReportResponse } from '../domain/refinanciamiento.types'

const dateLabel = (value: string | null | undefined) => value ? value.slice(0, 10).split('-').reverse().join('/') : 'Todos los períodos'
const dayLabel = (value: number | null) => value === null ? '—' : String(value)
const periodLabel = (from: string | null, to: string | null) => from || to ? `${from ? dateLabel(from) : 'Inicio'} — ${to ? dateLabel(to) : 'Fin'}` : 'Todos los períodos'

export interface RefinanciamientosPdfOptions {
  clienteNombre?: string
  filtros?: RefinanciamientoReportFilters
}

export function generarReporteRefinanciamientosPdf(response: RefinanciamientoReportResponse, options: RefinanciamientosPdfOptions = {}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const filtros = options.filtros ? {
    buscar: options.filtros.buscar ?? null,
    clienteId: options.filtros.clienteId ?? null,
    fechaDesde: options.filtros.fechaDesde ?? null,
    fechaHasta: options.filtros.fechaHasta ?? null,
  } : response.filtros
  const { resumen } = response
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const totalPagesToken = '___total_pages___'

  doc.setProperties({ title: 'Reporte de Refinanciamientos', subject: 'Préstamos No Bancarios' })
  doc.setTextColor(16, 42, 67)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('REPORTE DE REFINANCIAMIENTOS', 14, 16)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  doc.text('Préstamos No Bancarios', 14, 23)
  doc.text(`Generado: ${dateLabel(new Date().toISOString())}`, pageWidth - 14, 16, { align: 'right' })
  doc.text(`Período: ${periodLabel(filtros.fechaDesde, filtros.fechaHasta)}`, pageWidth - 14, 23, { align: 'right' })

  const activeFilters = [
    filtros.buscar ? `Buscar: ${filtros.buscar}` : '',
    options.clienteNombre ? `Cliente: ${options.clienteNombre}` : filtros.clienteId ? `Cliente ID: ${filtros.clienteId}` : '',
  ].filter(Boolean)
  if (activeFilters.length) doc.text(`Filtros: ${activeFilters.join(' · ')}`, 14, 30)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(16, 42, 67)
  doc.text('Resumen financiero', 14, 40)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const summary = [
    ['Refinanciamientos', String(resumen.cantidadRefinanciamientos)],
    ['Clientes', String(resumen.cantidadClientes)],
    ['Capital trasladado', formatCRC(resumen.totalCapitalTrasladado)],
    ['Dinero nuevo entregado', formatCRC(resumen.totalDineroNuevoDesembolsado)],
    ['Capital nuevo', formatCRC(resumen.totalCapitalNuevo)],
    ['Interés nuevo pactado', formatCRC(resumen.totalInteresNuevoPactado)],
  ]
  summary.forEach(([label, value], index) => {
    const x = 14 + index * 45
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(x, 43, 42, 15, 1.5, 1.5, 'F')
    doc.setTextColor(82, 102, 122)
    doc.text(label, x + 2, 48)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(16, 42, 67)
    doc.text(value, x + 2, 54)
    doc.setFont('helvetica', 'normal')
  })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(16, 42, 67)
  doc.text('Indicadores de refinanciamiento', 14, 66)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  const indicatorText = [
    `Con dinero nuevo: ${resumen.refinanciamientosConDineroNuevo}`,
    `Sin dinero nuevo: ${resumen.refinanciamientosSinDineroNuevo}`,
    `Anticipados: ${resumen.refinanciamientosAnticipados}`,
    `Sin anticipación: ${resumen.refinanciamientosSinAnticipacion}`,
    `${resumen.diasGanadosCompletos ? 'Promedio de días ganados' : 'Promedio de días conocidos'}: ${resumen.promedioDiasGanados === null ? '—' : resumen.promedioDiasGanados}`,
  ]
  doc.text(indicatorText.join(' · '), 14, 71)
  if (!resumen.diasGanadosCompletos) {
    doc.setFontSize(7)
    doc.text('Los registros históricos sin información contractual no permiten determinar todos los días ganados.', 14, 76)
  }

  const tableOptions: UserOptions = {
    startY: resumen.diasGanadosCompletos ? 77 : 81,
    margin: { left: 14, right: 14, bottom: 15 },
    theme: 'grid',
    head: [['Fecha', 'Cliente', 'Préstamo origen', 'Capital trasladado', 'Dinero nuevo', 'Capital nuevo', 'Interés nuevo', 'Días ganados', 'Préstamo nuevo']],
    foot: [[
      'TOTALES', '', '', formatCRC(resumen.totalCapitalTrasladado), formatCRC(resumen.totalDineroNuevoDesembolsado),
      formatCRC(resumen.totalCapitalNuevo), formatCRC(resumen.totalInteresNuevoPactado), '', '',
    ]],
    body: response.datos.map((item) => [
      dateLabel(item.fecha), item.cliente.nombreCompleto, `#${item.prestamoOrigenId}`, formatCRC(item.capitalTrasladado),
      formatCRC(item.dineroNuevoDesembolsado), formatCRC(item.capitalNuevo), formatCRC(item.interesNuevo), dayLabel(item.diasGanados), `#${item.prestamoNuevoId}`,
    ]),
    styles: { font: 'helvetica', fontSize: 7, cellPadding: 2, overflow: 'linebreak', valign: 'middle' },
    headStyles: { fillColor: [16, 42, 67], textColor: 255, fontStyle: 'bold', fontSize: 7 },
    footStyles: { fillColor: [226, 232, 240], textColor: [16, 42, 67], fontStyle: 'bold', fontSize: 7 },
    columnStyles: { 1: { cellWidth: 43 }, 2: { cellWidth: 22 }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'center', cellWidth: 18 }, 8: { cellWidth: 22 } },
    showHead: 'everyPage',
    showFoot: 'lastPage',
    rowPageBreak: 'avoid',
    didDrawPage: ({ pageNumber }) => {
      doc.setDrawColor(203, 213, 225)
      doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(100, 116, 139)
      doc.text('Reporte generado por Préstamos No Bancarios', 14, pageHeight - 7)
      doc.text(`Página ${pageNumber} de ${totalPagesToken}`, pageWidth - 14, pageHeight - 7, { align: 'right' })
    },
  }
  autoTable(doc, tableOptions)
  const pdfWithTotalPages = doc as jsPDF & { putTotalPages?: (pageExpression: string) => void }
  pdfWithTotalPages.putTotalPages?.(totalPagesToken)
  const safeDate = filtros.fechaDesde && filtros.fechaHasta ? `${filtros.fechaDesde}_${filtros.fechaHasta}` : new Date().toISOString().slice(0, 10)
  doc.save(`Reporte_Refinanciamientos_${safeDate}.pdf`)
}
