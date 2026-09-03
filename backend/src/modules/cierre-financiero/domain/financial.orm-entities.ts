import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { numberTransformer } from '../../prestamos/infrastructure/persistence/typeorm/number.transformer';

@Entity('configuracion_financiera')
@Index('UQ_configuracion_financiera_singleton', ['singletonKey'], { unique: true })
export class ConfiguracionFinancieraOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'singleton_key', type: 'text', default: 'FINANCIERA' }) singletonKey!: string;
  @Column({ name: 'fecha_apertura', type: 'date' }) fechaApertura!: string;
  @Column({ name: 'cartera_inicial', type: 'numeric', precision: 14, scale: 2, transformer: numberTransformer }) carteraInicial!: number;
  @Column({ name: 'cartera_activa_inicial', type: 'numeric', precision: 14, scale: 2, transformer: numberTransformer }) carteraActivaInicial!: number;
  @Column({ name: 'cartera_incobrable_inicial', type: 'numeric', precision: 14, scale: 2, transformer: numberTransformer }) carteraIncobrableInicial!: number;
  @Column({ name: 'disponible_inicial', type: 'numeric', precision: 14, scale: 2, transformer: numberTransformer }) disponibleInicial!: number;
  @Column({ name: 'capital_semilla_historico', type: 'numeric', precision: 14, scale: 2, nullable: true, transformer: numberTransformer }) capitalSemillaHistorico!: number | null;
  @Column({ type: 'text', nullable: true }) observaciones!: string | null;
  @Column({ name: 'usuario_apertura_id', type: 'integer' }) usuarioAperturaId!: number;
  @CreateDateColumn({ name: 'fecha_creacion', type: 'timestamp' }) fechaCreacion!: Date;
}

@Entity('cierre_mensual')
@Unique('UQ_cierre_mensual_anio_mes', ['anio', 'mes'])
export class CierreMensualOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column() anio!: number;
  @Column() mes!: number;
  @Column({ name: 'fecha_inicio', type: 'date' }) fechaInicio!: string;
  @Column({ name: 'fecha_fin', type: 'date' }) fechaFin!: string;
  @Column({ name: 'fecha_cierre', type: 'timestamp' }) fechaCierre!: Date;
  @Column({ name: 'usuario_cierre_id', type: 'integer' }) usuarioCierreId!: number;
  @Column({ type: 'text', nullable: true }) observaciones!: string | null;
  @CreateDateColumn({ name: 'fecha_creacion', type: 'timestamp' }) fechaCreacion!: Date;
}

export enum ConceptoDetalleCorte {
  CARTERA_INICIAL = 'CARTERA_INICIAL', CARTERA_ACTIVA_INICIAL = 'CARTERA_ACTIVA_INICIAL', CARTERA_INCOBRABLE_INICIAL = 'CARTERA_INCOBRABLE_INICIAL',
  CARTERA_ACTIVA_FINAL = 'CARTERA_ACTIVA_FINAL', CARTERA_INCOBRABLE_FINAL = 'CARTERA_INCOBRABLE_FINAL', CARTERA_TOTAL_FINAL = 'CARTERA_TOTAL_FINAL',
  DISPONIBLE_INICIAL = 'DISPONIBLE_INICIAL', DISPONIBLE_FINAL = 'DISPONIBLE_FINAL', PAGOS_RECIBIDOS = 'PAGOS_RECIBIDOS', CAPITAL_RECUPERADO = 'CAPITAL_RECUPERADO',
  INTERESES_COBRADOS = 'INTERESES_COBRADOS', DESEMBOLSOS_PRESTAMOS = 'DESEMBOLSOS_PRESTAMOS', DESEMBOLSOS_REFINANCIAMIENTOS = 'DESEMBOLSOS_REFINANCIAMIENTOS',
  MONTO_REFINANCIADO = 'MONTO_REFINANCIADO', APORTES_CAPITAL = 'APORTES_CAPITAL', RETIROS = 'RETIROS', GASTOS = 'GASTOS', AJUSTES_ENTRADA = 'AJUSTES_ENTRADA',
  AJUSTES_SALIDA = 'AJUSTES_SALIDA', ENTRADAS_CAJA = 'ENTRADAS_CAJA', SALIDAS_CAJA = 'SALIDAS_CAJA', RESULTADO_MES = 'RESULTADO_MES',
}

@Entity('detalle_corte_mensual')
@Unique('UQ_detalle_corte_mensual_concepto', ['corteId', 'concepto'])
export class DetalleCorteMensualOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'corte_id', type: 'integer' }) corteId!: number;
  @ManyToOne(() => CierreMensualOrmEntity, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'corte_id' }) corte!: CierreMensualOrmEntity;
  @Column({ type: 'enum', enum: ConceptoDetalleCorte, enumName: 'detalle_corte_mensual_concepto_enum' }) concepto!: ConceptoDetalleCorte;
  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: numberTransformer }) monto!: number;
}
