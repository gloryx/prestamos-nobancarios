import type { ClosingDetail, ClosingPreview, ClosingSnapshot } from '../domain/cierre-mensual.types'
import { closingConcepts } from '../domain/cierre-mensual.types'
import { formatCRC } from '@/shared/utils/currency'

type FinancialModel = ClosingPreview | ClosingSnapshot
type Group = { title: string; concepts: ClosingDetail['concepto'][] }
type ConceptTone = 'neutral' | 'available-initial' | 'available-final' | 'positive' | 'negative' | 'result-positive' | 'result-negative' | 'result-neutral'

const groups: Group[] = [
  { title: 'Disponibilidad', concepts: ['DISPONIBLE_INICIAL', 'ENTRADAS_CAJA', 'SALIDAS_CAJA', 'DISPONIBLE_FINAL'] },
  { title: 'Cartera inicio', concepts: ['CARTERA_INICIAL', 'CARTERA_ACTIVA_INICIAL', 'CARTERA_INCOBRABLE_INICIAL'] },
  { title: 'Cartera final', concepts: ['CARTERA_ACTIVA_FINAL', 'CARTERA_INCOBRABLE_FINAL', 'CARTERA_TOTAL_FINAL'] },
  { title: 'Pagos / recuperación', concepts: ['PAGOS_RECIBIDOS', 'CAPITAL_RECUPERADO', 'INTERESES_COBRADOS'] },
  { title: 'Colocación / refinanciamientos', concepts: ['DESEMBOLSOS_PRESTAMOS', 'DESEMBOLSOS_REFINANCIAMIENTOS', 'MONTO_REFINANCIADO'] },
  { title: 'Movimientos administrativos', concepts: ['APORTES_CAPITAL', 'RETIROS', 'GASTOS', 'AJUSTES_ENTRADA', 'AJUSTES_SALIDA'] },
  { title: 'Resultado', concepts: ['RESULTADO_MES'] },
]

const labels: Record<ClosingDetail['concepto'], string> = {
  CARTERA_INICIAL: 'Cartera inicial', CARTERA_ACTIVA_INICIAL: 'Cartera activa inicial', CARTERA_INCOBRABLE_INICIAL: 'Cartera incobrable inicial',
  CARTERA_ACTIVA_FINAL: 'Cartera activa final', CARTERA_INCOBRABLE_FINAL: 'Cartera incobrable final', CARTERA_TOTAL_FINAL: 'Cartera total final',
  DISPONIBLE_INICIAL: 'Disponible inicial', DISPONIBLE_FINAL: 'Disponible final', PAGOS_RECIBIDOS: 'Pagos recibidos', CAPITAL_RECUPERADO: 'Capital recuperado',
  INTERESES_COBRADOS: 'Intereses cobrados', DESEMBOLSOS_PRESTAMOS: 'Desembolsos de préstamos', DESEMBOLSOS_REFINANCIAMIENTOS: 'Desembolsos de refinanciamientos',
  MONTO_REFINANCIADO: 'Monto refinanciado', APORTES_CAPITAL: 'Aportes de capital', RETIROS: 'Retiros', GASTOS: 'Gastos', AJUSTES_ENTRADA: 'Ajustes de entrada',
  AJUSTES_SALIDA: 'Ajustes de salida', ENTRADAS_CAJA: 'Entradas de Caja', SALIDAS_CAJA: 'Salidas de Caja', RESULTADO_MES: 'Resultado del mes',
}

const positiveConcepts = new Set<ClosingDetail['concepto']>(['ENTRADAS_CAJA', 'APORTES_CAPITAL'])
const negativeConcepts = new Set<ClosingDetail['concepto']>(['SALIDAS_CAJA', 'RETIROS', 'GASTOS', 'DESEMBOLSOS_PRESTAMOS', 'DESEMBOLSOS_REFINANCIAMIENTOS'])

function conceptTone(concept: ClosingDetail['concepto'], amount: number): ConceptTone {
  if (concept === 'RESULTADO_MES') return amount > 0 ? 'result-positive' : amount < 0 ? 'result-negative' : 'result-neutral'
  if (concept === 'DISPONIBLE_INICIAL') return 'available-initial'
  if (concept === 'DISPONIBLE_FINAL') return 'available-final'
  if (positiveConcepts.has(concept)) return 'positive'
  if (negativeConcepts.has(concept)) return 'negative'
  return 'neutral'
}

function conceptSign(concept: ClosingDetail['concepto'], amount: number): string {
  if (concept === 'RESULTADO_MES') return amount > 0 ? 'positivo' : amount < 0 ? 'negativo' : 'neutral'
  if (positiveConcepts.has(concept)) return 'entrada'
  if (negativeConcepts.has(concept)) return 'salida'
  return 'neutral'
}

export function CierreMensualFinancialView({ model }: { model: FinancialModel }) {
  const values = new Map(model.detalles.map(detail => [detail.concepto, detail.monto]))
  return <div className="monthly-closing-financial-view">
    <div className="monthly-closing-groups">
      {groups.map(group => <section className="panel monthly-closing-group" key={group.title} aria-labelledby={`closing-group-${group.title}`}><h3 id={`closing-group-${group.title}`}>{group.title}</h3>{group.title === 'Disponibilidad' && <p className="monthly-closing-reconciliation" role="note">Conciliación de Caja: los cuatro valores siguientes se muestran directamente desde el backend para facilitar la revisión del disponible inicial, las entradas y salidas, y el disponible final. No se recalculan en esta pantalla.</p>}<dl>{group.concepts.map(concept => { const amount = values.get(concept) ?? 0; const tone = conceptTone(concept, amount); const sign = conceptSign(concept, amount); const signMarker = tone === 'positive' ? '+' : tone === 'negative' ? '−' : ''; return <div className={`monthly-closing-concept monthly-closing-concept--${tone}`} key={concept}><dt>{labels[concept]}{group.title === 'Disponibilidad' && <span className="monthly-closing-concept-code"> ({concept})</span>}</dt><dd aria-label={`${labels[concept]}: ${sign}, ${formatCRC(amount)}`}><span className="monthly-closing-sign" aria-hidden="true">{signMarker}</span>{formatCRC(amount)}<span className="sr-only"> ({sign})</span></dd></div> })}</dl></section>)}
    </div>
    <aside className="monthly-closing-review-notes" role="note" aria-label="Claves para revisar"><h3>Claves para revisar</h3><ul><li>Pagos recibidos = capital recuperado + intereses cobrados.</li><li>El capital no es ganancia; los intereses son un componente del resultado.</li><li>El monto refinanciado no es una salida de Caja; solo el desembolso adicional es dinero nuevo.</li><li>El resultado del mes = intereses cobrados - gastos; no es Caja, cartera ni flujo neto.</li></ul></aside>
    {values.size !== closingConcepts.length && <p className="monthly-closing-note" role="status">El backend no devolvió todos los conceptos esperados; los faltantes se muestran en cero sin recalcular valores.</p>}
  </div>
}
