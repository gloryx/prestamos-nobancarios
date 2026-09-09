import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PlanPagoOrmEntity } from '../../../../planes-pago/infrastructure/persistence/typeorm/plan-pago.orm-entity';
import { FormaPagoOrmEntity } from '../../../../formas-pago/infrastructure/persistence/typeorm/forma-pago.orm-entity';
import { PrestamoOrmEntity } from '../../../../prestamos/infrastructure/persistence/typeorm/prestamo.orm-entity';
import { UsuarioOrmEntity } from '../../../../usuarios/infrastructure/persistence/typeorm/usuario.orm-entity';
import { numberTransformer } from '../../../../prestamos/infrastructure/persistence/typeorm/number.transformer';
import { EstadoPago } from '../../../domain/enums/estado-pago.enum';
import { PagoAnulacionOrmEntity } from './pago-anulacion.orm-entity';
@Entity('pago')
@Index('IDX_pago_prestamo_fecha', ['prestamoId', 'fecha'])
@Index('IDX_pago_plan_pago', ['planPagoId'])
export class PagoOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'prestamo_id', type: 'integer' }) prestamoId!: number;
  @ManyToOne(() => PrestamoOrmEntity, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'prestamo_id' }) prestamo!: PrestamoOrmEntity;
  @Column({ name: 'forma_pago_id', type: 'integer' }) formaPagoId!: number;
  @ManyToOne(() => FormaPagoOrmEntity, { nullable: false, onDelete: 'RESTRICT' }) @JoinColumn({ name: 'forma_pago_id' }) formaPago!: FormaPagoOrmEntity;
  @Column({ name: 'plan_pago_id', type: 'integer', nullable: true }) planPagoId!: number | null;
  @ManyToOne(() => PlanPagoOrmEntity, (plan) => plan.pagos, { nullable: true, onDelete: 'RESTRICT' }) @JoinColumn({ name: 'plan_pago_id' }) planPago!: PlanPagoOrmEntity | null;
  @Column({ name: 'redistribuyo_plan', type: 'boolean', nullable: true }) redistribuyoPlan!: boolean | null;
  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: numberTransformer }) monto!: number;
  @Column({ name: 'capital_aplicado', type: 'numeric', precision: 14, scale: 2, transformer: numberTransformer }) capitalAplicado!: number;
  @Column({ name: 'interes_aplicado', type: 'numeric', precision: 14, scale: 2, transformer: numberTransformer }) interesAplicado!: number;
  @Column({ name: 'cobrador_id', type: 'integer' }) cobradorId!: number;
  @ManyToOne(() => UsuarioOrmEntity, { nullable: false, onDelete: 'RESTRICT' }) @JoinColumn({ name: 'cobrador_id' }) cobrador!: UsuarioOrmEntity;
  @Column({ type: 'date' }) fecha!: string;
  @Column({ type: 'text', nullable: true }) observaciones!: string | null;
  @CreateDateColumn({ name: 'fecha_creacion', type: 'timestamp' }) fechaCreacion!: Date;
  @Column({ type: 'enum', enum: EstadoPago, enumName: 'pago_estado_enum', default: EstadoPago.REGISTRADO }) estado!: EstadoPago;
  @OneToOne(() => PagoAnulacionOrmEntity, (anulacion) => anulacion.pago) anulacion!: PagoAnulacionOrmEntity | null;
}
