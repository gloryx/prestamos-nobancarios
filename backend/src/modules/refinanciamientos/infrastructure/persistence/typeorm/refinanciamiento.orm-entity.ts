import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { PrestamoOrmEntity } from '../../../../prestamos/infrastructure/persistence/typeorm/prestamo.orm-entity';
import { numberTransformer } from '../../../../prestamos/infrastructure/persistence/typeorm/number.transformer';

@Entity('refinanciamiento')
@Unique('UQ_refinanciamiento_prestamo_origen', ['prestamoOrigenId'])
@Unique('UQ_refinanciamiento_prestamo_nuevo', ['prestamoNuevoId'])
export class RefinanciamientoOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'prestamo_origen_id', type: 'integer', nullable: false }) prestamoOrigenId!: number;
  @ManyToOne(() => PrestamoOrmEntity, { nullable: false, onDelete: 'RESTRICT' }) @JoinColumn({ name: 'prestamo_origen_id' }) prestamoOrigen!: PrestamoOrmEntity;
  @Column({ name: 'prestamo_nuevo_id', type: 'integer', nullable: false }) prestamoNuevoId!: number;
  @ManyToOne(() => PrestamoOrmEntity, { nullable: false, onDelete: 'RESTRICT' }) @JoinColumn({ name: 'prestamo_nuevo_id' }) prestamoNuevo!: PrestamoOrmEntity;
  @Column({ type: 'date', nullable: false }) fecha!: string;
  @Column({ name: 'fecha_limite_contractual_origen', type: 'date', nullable: true }) fechaLimiteContractualOrigen!: string | null;
  @Column({ name: 'capital_pendiente', type: 'numeric', precision: 14, scale: 2, transformer: numberTransformer }) capitalPendiente!: number;
  @Column({ name: 'interes_pendiente', type: 'numeric', precision: 14, scale: 2, transformer: numberTransformer }) interesPendiente!: number;
  @Column({ name: 'monto_refinanciado', type: 'numeric', precision: 14, scale: 2, transformer: numberTransformer }) montoRefinanciado!: number;
  @Column({ name: 'interes_nuevo', type: 'numeric', precision: 14, scale: 2, transformer: numberTransformer }) interesNuevo!: number;
  @Column({ type: 'text', nullable: true }) observaciones!: string | null;
  @CreateDateColumn({ name: 'fecha_creacion', type: 'timestamp' }) fechaCreacion!: Date;
}
