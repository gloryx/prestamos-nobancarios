export const RENTABILIDAD_CANCELADOS_REPOSITORY = Symbol('RENTABILIDAD_CANCELADOS_REPOSITORY');

export type RentabilidadCanceladaFact = {
  capital: number;
  ganancia: number;
  fechaAlta: string;
  fechaCancelacion: string;
};

export interface RentabilidadCanceladosRepository {
  listar(anio: number, mes: number): Promise<RentabilidadCanceladaFact[]>;
}
