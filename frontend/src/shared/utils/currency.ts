const crcNumberFormatter = new Intl.NumberFormat('es-CR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function formatCRC(value: number): string {
  const formatted = crcNumberFormatter.format(value)
  return formatted.startsWith('-') ? `-₡${formatted.slice(1)}` : `₡${formatted}`
}
