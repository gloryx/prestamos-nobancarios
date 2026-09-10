import { ApiProperty } from '@nestjs/swagger';

class ReporteFiltrosDto {
  @ApiProperty({ nullable: true }) buscar!: string | null;
  @ApiProperty({ nullable: true }) clienteId!: number | null;
  @ApiProperty({ nullable: true, format: 'date' }) fechaDesde!: string | null;
  @ApiProperty({ nullable: true, format: 'date' }) fechaHasta!: string | null;
}

class ReporteClienteDto {
  @ApiProperty() id!: number;
  @ApiProperty() identificacion!: string;
  @ApiProperty() nombreCompleto!: string;
}

class RefinanciamientoReporteDetalleDto {
  @ApiProperty() id!: number;
  @ApiProperty({ format: 'date' }) fecha!: string;
  @ApiProperty({ type: ReporteClienteDto }) cliente!: ReporteClienteDto;
  @ApiProperty() prestamoOrigenId!: number;
  @ApiProperty({ description: 'Capital pendiente trasladado desde el préstamo origen.' }) capitalTrasladado!: number;
  @ApiProperty({ description: 'Dinero nuevo efectivamente desembolsado por el préstamo nuevo.' }) dineroNuevoDesembolsado!: number;
  @ApiProperty({ description: 'Capital del préstamo nuevo.' }) capitalNuevo!: number;
  @ApiProperty({ description: 'Interés nuevo pactado en el refinanciamiento.' }) interesNuevo!: number;
  @ApiProperty({ nullable: true, description: 'Días ganados; null cuando el registro histórico no tiene snapshot contractual.' }) diasGanados!: number | null;
  @ApiProperty() prestamoNuevoId!: number;
}

class RefinanciamientosReporteResumenDto {
  @ApiProperty() cantidadRefinanciamientos!: number;
  @ApiProperty() cantidadClientes!: number;
  @ApiProperty({ description: 'Suma del capital pendiente trasladado desde los préstamos origen.' }) totalCapitalTrasladado!: number;
  @ApiProperty({ description: 'Suma del dinero nuevo efectivamente desembolsado por los préstamos nuevos.' }) totalDineroNuevoDesembolsado!: number;
  @ApiProperty({ description: 'Suma del capital pactado en los préstamos nuevos.' }) totalCapitalNuevo!: number;
  @ApiProperty({ description: 'Suma del interés nuevo pactado en los refinanciamientos.' }) totalInteresNuevoPactado!: number;
  @ApiProperty() refinanciamientosConDineroNuevo!: number;
  @ApiProperty() refinanciamientosSinDineroNuevo!: number;
  @ApiProperty() refinanciamientosAnticipados!: number;
  @ApiProperty() refinanciamientosSinAnticipacion!: number;
  @ApiProperty({ nullable: true, description: 'Promedio redondeado de días ganados, calculado únicamente con días conocidos.' }) promedioDiasGanados!: number | null;
  @ApiProperty({ description: 'True only when every result has known days; empty reports are complete by convention.' }) diasGanadosCompletos!: boolean;
}

export class RefinanciamientosReporteResponseDto {
  @ApiProperty({ type: ReporteFiltrosDto }) filtros!: ReporteFiltrosDto;
  @ApiProperty({ type: RefinanciamientosReporteResumenDto }) resumen!: RefinanciamientosReporteResumenDto;
  @ApiProperty({ type: [RefinanciamientoReporteDetalleDto] }) datos!: RefinanciamientoReporteDetalleDto[];
}
