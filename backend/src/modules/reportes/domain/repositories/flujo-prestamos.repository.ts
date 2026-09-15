export const FLUJO_PRESTAMOS_REPOSITORY = Symbol('FLUJO_PRESTAMOS_REPOSITORY');

export interface FlujoPeriodoRow { periodo: string; monto: string | number; capitalAplicado?: string | number; interesAplicado?: string | number }

export interface FlujoPrestamosRepository {
  pagos(desde: string, hasta: string): Promise<FlujoPeriodoRow[]>;
  desembolsos(desde: string, hasta: string): Promise<FlujoPeriodoRow[]>;
}
