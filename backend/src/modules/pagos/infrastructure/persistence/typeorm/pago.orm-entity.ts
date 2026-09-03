import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { FormaPagoOrmEntity } from '../../../../formas-pago/infrastructure/persistence/typeorm/forma-pago.orm-entity';
import { PrestamoOrmEntity } from '../../../../prestamos/infrastructure/persistence/typeorm/prestamo.orm-entity';
import { UsuarioOrmEntity } from '../../../../usuarios/infrastructure/persistence/typeorm/usuario.orm-entity';
import { numberTransformer } from '../../../../prestamos/infrastructure/persistence/typeorm/number.transformer';

@Entity('pago')
@Index('IDX_pago_prestamo_fecha', ['prestamoId', 'fecha'])
export class PagoOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'prestamo_id', type: 'integer' }) prestamoId!: number;
  @ManyToOne(() => PrestamoOrmEntity, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'prestamo_id' }) prestamo!: PrestamoOrmEntity;
  @Column({ name: 'forma_pago_id', type: 'integer' }) formaPagoId!: number;
  @ManyToOne(() => FormaPagoOrmEntity, { nullable: false, onDelete: 'RESTRICT' }) @JoinColumn({ name: 'forma_pago_id' }) formaPago!: FormaPagoOrmEntity;
  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: numberTransformer }) monto!: number;
  @Column({ name: 'capital_aplicado', type: 'numeric', precision: 14, scale: 2, transformer: numberTransformer }) capitalAplicado!: number;
  @Column({ name: 'interes_aplicado', type: 'numeric', precision: 14, scale: 2, transformer: numberTransformer }) interesAplicado!: number;
  // Existing databases with NULL cobrador_id require an explicit data migration before synchronization can succeed.
  @Column({ name: 'cobrador_id', type: 'integer', nullable: false }) cobradorId!: number;
  @ManyToOne(() => UsuarioOrmEntity, { nullable: false, onDelete: 'RESTRICT' }) @JoinColumn({ name: 'cobrador_id' }) cobrador!: UsuarioOrmEntity;
  @Column({ name: 'fecha', type: 'date' }) fecha!: string;
  @Column({ type: 'text', nullable: true }) observaciones!: string | null;
  @CreateDateColumn({ name: 'fecha_creacion', type: 'timestamp' }) fechaCreacion!: Date;
}
