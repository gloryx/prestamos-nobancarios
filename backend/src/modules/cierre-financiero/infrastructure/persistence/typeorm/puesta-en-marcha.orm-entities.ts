import { Check, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { numberTransformer } from '../../../../prestamos/infrastructure/persistence/typeorm/number.transformer';
import { UsuarioOrmEntity } from '../../../../usuarios/infrastructure/persistence/typeorm/usuario.orm-entity';
import { ConfiguracionFinancieraOrmEntity } from '../../../domain/financial.orm-entities';
import { ConceptoSaldoPuesta, ModalidadPuestaEnMarcha, ProcedenciaSaldo } from '../../../domain/puesta-en-marcha';

@Entity('puesta_marcha_financiera')
@Unique('UQ_puesta_marcha_financiera_configuracion', ['configuracionFinancieraId'])
@Check('CHK_puesta_marcha_financiera_fechas', '"fecha_base" < "fecha_inicio_cierres"')
export class PuestaMarchaFinancieraOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'configuracion_financiera_id', type: 'integer' }) configuracionFinancieraId!: number;
  @ManyToOne(() => ConfiguracionFinancieraOrmEntity, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'configuracion_financiera_id' }) configuracionFinanciera!: ConfiguracionFinancieraOrmEntity;
  @Column({ name: 'fecha_base', type: 'date' }) fechaBase!: string;
  @Column({ name: 'fecha_inicio_cierres', type: 'date' }) fechaInicioCierres!: string;
  @Column({ type: 'enum', enum: ModalidadPuestaEnMarcha, enumName: 'puesta_marcha_financiera_modalidad_enum' }) modalidad!: ModalidadPuestaEnMarcha;
  @Column({ name: 'usuario_confirmacion_id', type: 'integer' }) usuarioConfirmacionId!: number;
  @ManyToOne(() => UsuarioOrmEntity, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'usuario_confirmacion_id' }) usuarioConfirmacion!: UsuarioOrmEntity;
  @Column({ name: 'fecha_confirmacion', type: 'timestamp' }) fechaConfirmacion!: Date;
  @Column({ type: 'text', nullable: true }) observaciones!: string | null;
  @CreateDateColumn({ name: 'fecha_creacion', type: 'timestamp' }) fechaCreacion!: Date;
  @OneToMany(() => PuestaMarchaFinancieraSaldoOrmEntity, (saldo) => saldo.puestaMarcha, { cascade: false }) saldos!: PuestaMarchaFinancieraSaldoOrmEntity[];
}

@Entity('puesta_marcha_financiera_saldo')
@Unique('UQ_puesta_marcha_financiera_saldo_concepto', ['puestaMarchaId', 'concepto'])
@Check('CHK_puesta_marcha_financiera_saldo_monto', '"monto" >= 0')
export class PuestaMarchaFinancieraSaldoOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'puesta_marcha_id', type: 'integer' }) puestaMarchaId!: number;
  @ManyToOne(() => PuestaMarchaFinancieraOrmEntity, (puestaMarcha) => puestaMarcha.saldos, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'puesta_marcha_id' }) puestaMarcha!: PuestaMarchaFinancieraOrmEntity;
  @Column({ type: 'enum', enum: ConceptoSaldoPuesta, enumName: 'puesta_marcha_financiera_concepto_enum' }) concepto!: ConceptoSaldoPuesta;
  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: numberTransformer }) monto!: number;
  @Column({ type: 'enum', enum: ProcedenciaSaldo, enumName: 'puesta_marcha_financiera_procedencia_enum' }) procedencia!: ProcedenciaSaldo;
  @Column({ type: 'text', nullable: true }) evidencia!: string | null;
  @Column({ type: 'text', nullable: true }) observacion!: string | null;
}
