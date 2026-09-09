import { EstadoPrestamo } from '../../../prestamos/domain/enums/estado-prestamo.enum';

const money = (value: number): number => Math.round(value * 100) / 100;

export interface CalculoElegibilidadRefinanciamiento {
  totalPagado: number;
  interesRequerido: number;
  interesPendienteParaRefinanciar: number;
  capitalAmortizadoRefinanciamiento: number;
  capitalPendienteRefinanciable: number;
  elegible: boolean;
  motivo: string | null;
}

export function calcularElegibilidadRefinanciamiento(input: {
  estado: EstadoPrestamo;
  capital: number;
  interes: number;
  totalPagado: number;
}): CalculoElegibilidadRefinanciamiento {
  const totalPagado = money(input.totalPagado);
  const interesRequerido = money(input.interes);
  const interesPendienteParaRefinanciar = money(Math.max(0, interesRequerido - totalPagado));
  const capitalAmortizadoRefinanciamiento = money(Math.max(0, totalPagado - interesRequerido));
  const capitalPendienteRefinanciable = money(Math.max(0, input.capital - capitalAmortizadoRefinanciamiento));

  let motivo: string | null = null;
  if (input.estado !== EstadoPrestamo.ACTIVO) {
    motivo = `El préstamo está ${input.estado} y solo los préstamos activos son elegibles para refinanciamiento.`;
  } else if (interesPendienteParaRefinanciar > 0) {
    motivo = `El interés pactado no está cubierto; faltan ${interesPendienteParaRefinanciar}.`;
  } else if (capitalPendienteRefinanciable <= 0) {
    motivo = 'El préstamo no tiene saldo pendiente para refinanciar.';
  }

  return {
    totalPagado,
    interesRequerido,
    interesPendienteParaRefinanciar,
    capitalAmortizadoRefinanciamiento,
    capitalPendienteRefinanciable,
    elegible: motivo === null,
    motivo,
  };
}
