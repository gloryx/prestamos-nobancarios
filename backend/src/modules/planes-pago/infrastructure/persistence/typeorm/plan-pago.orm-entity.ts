import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { PrestamoOrmEntity } from '../../../../prestamos/infrastructure/persistence/typeorm/prestamo.orm-entity';
import { numberTransformer } from '../../../../prestamos/infrastructure/persistence/typeorm/number.transformer';

@Entity('plan_pago')
@Unique('UQ_plan_pago_prestamo_numero', ['prestamoId', 'numeroPago'])
@Index('IDX_plan_pago_prestamo', ['prestamoId'])
export class PlanPagoOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'prestamo_id', type: 'integer' }) prestamoId!: number;
  @ManyToOne(() => PrestamoOrmEntity, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'prestamo_id' }) prestamo!: PrestamoOrmEntity;
  @Column({ name: 'numero_pago', type: 'integer' }) numeroPago!: number;
  @Column({ name: 'fecha_vencimiento', type: 'date' }) fechaVencimiento!: string;
  @Column({ name: 'monto_programado', type: 'numeric', precision: 14, scale: 2, transformer: numberTransformer }) montoProgramado!: number;
  @CreateDateColumn({ name: 'fecha_creacion', type: 'timestamp' }) fechaCreacion!: Date;
}
