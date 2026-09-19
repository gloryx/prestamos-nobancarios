import { ConceptoSaldoPuesta, ModalidadPuestaEnMarcha, ProcedenciaSaldo } from './enums';

export interface SaldoPuestaEnMarcha {
  concepto: ConceptoSaldoPuesta;
  monto: number;
  procedencia: ProcedenciaSaldo;
  evidencia?: string;
  observacion?: string;
}

export interface ContextoPuestaEnMarcha {
  fechaApertura?: string;
}

export interface PuestaEnMarchaFinanciera {
  modalidad: ModalidadPuestaEnMarcha;
  fechaBase: string;
  fechaInicioCierres: string;
  saldos: SaldoPuestaEnMarcha[];
  observaciones?: string;
}

export interface PrimerPeriodo {
  fechaInicio: string;
  fechaFin: string;
}
