const MS_PER_DAY = 86_400_000;

const utcDay = (value: Date) => Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());

export const calcularDiasGanados = (fechaLimite: Date | null, fechaRefinanciamiento: Date): number | null => {
  if (!fechaLimite) return null;
  return Math.max(0, Math.round((utcDay(fechaLimite) - utcDay(fechaRefinanciamiento)) / MS_PER_DAY));
};
