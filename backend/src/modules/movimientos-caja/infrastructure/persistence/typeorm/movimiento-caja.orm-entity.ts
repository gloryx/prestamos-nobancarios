import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { FormaPagoOrmEntity } from '../../../../formas-pago/infrastructure/persistence/typeorm/forma-pago.orm-entity';
import { PagoOrmEntity } from '../../../../pagos/infrastructure/persistence/typeorm/pago.orm-entity';
import { PrestamoOrmEntity } from '../../../../prestamos/infrastructure/persistence/typeorm/prestamo.orm-entity';
import { numberTransformer } from '../../../../prestamos/infrastructure/persistence/typeorm/number.transformer';
import { RefinanciamientoOrmEntity } from '../../../../refinanciamientos/infrastructure/persistence/typeorm/refinanciamiento.orm-entity';
import { UsuarioOrmEntity } from '../../../../usuarios/infrastructure/persistence/typeorm/usuario.orm-entity';
import { ConceptoMovimientoCaja } from '../../../domain/enums/concepto-movimiento-caja.enum';
import { TipoMovimientoCaja } from '../../../domain/enums/tipo-movimiento-caja.enum';

@Entity('movimiento_caja')
@Index('IDX_movimiento_caja_fecha_id', ['fecha', 'id'])
@Index('IDX_movimiento_caja_tipo_concepto', ['tipo', 'concepto'])
@Index('UQ_movimiento_caja_pago_cliente', ['pagoId'], { unique: true, where: '"concepto" = \'PAGO_CLIENTE\' AND "pago_id" IS NOT NULL' })
@Index('UQ_movimiento_caja_refinanciamiento', ['refinanciamientoId'], { unique: true, where: '"concepto" = \'DESEMBOLSO_REFINANCIAMIENTO\' AND "refinanciamiento_id" IS NOT NULL' })
@Index('UQ_movimiento_caja_prestamo', ['prestamoId'], { unique: true, where: '"concepto" = \'DESEMBOLSO_PRESTAMO\' AND "prestamo_id" IS NOT NULL' })
@Index('UQ_movimiento_caja_reversado', ['movimientoReversadoId'], { unique: true, where: '"movimiento_reversado_id" IS NOT NULL' })
export class MovimientoCajaOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'enum', enum: TipoMovimientoCaja, enumName: 'movimiento_caja_tipo_enum' }) tipo!: TipoMovimientoCaja;
  @Column({ type: 'enum', enum: ConceptoMovimientoCaja, enumName: 'movimiento_caja_concepto_enum' }) concepto!: ConceptoMovimientoCaja;
  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: numberTransformer }) monto!: number;
  @Column({ type: 'date' }) fecha!: string;
  @Column({ type: 'text', nullable: true }) observaciones!: string | null;
  @Column({ name: 'pago_id', type: 'integer', nullable: true }) pagoId!: number | null;
  @ManyToOne(() => PagoOrmEntity, { nullable: true, onDelete: 'RESTRICT' }) @JoinColumn({ name: 'pago_id' }) pago!: PagoOrmEntity | null;
  @Column({ name: 'forma_pago_id', type: 'integer', nullable: true }) formaPagoId!: number | null;
  @ManyToOne(() => FormaPagoOrmEntity, { nullable: true, onDelete: 'RESTRICT' }) @JoinColumn({ name: 'forma_pago_id' }) formaPago!: FormaPagoOrmEntity | null;
  @Column({ name: 'prestamo_id', type: 'integer', nullable: true }) prestamoId!: number | null;
  @ManyToOne(() => PrestamoOrmEntity, { nullable: true, onDelete: 'RESTRICT' }) @JoinColumn({ name: 'prestamo_id' }) prestamo!: PrestamoOrmEntity | null;
  @Column({ name: 'refinanciamiento_id', type: 'integer', nullable: true }) refinanciamientoId!: number | null;
  @ManyToOne(() => RefinanciamientoOrmEntity, { nullable: true, onDelete: 'RESTRICT' }) @JoinColumn({ name: 'refinanciamiento_id' }) refinanciamiento!: RefinanciamientoOrmEntity | null;
  @Column({ name: 'movimiento_reversado_id', type: 'integer', nullable: true }) movimientoReversadoId!: number | null;
  @ManyToOne(() => MovimientoCajaOrmEntity, { nullable: true, onDelete: 'RESTRICT' }) @JoinColumn({ name: 'movimiento_reversado_id' }) movimientoReversado!: MovimientoCajaOrmEntity | null;
  @OneToMany(() => MovimientoCajaOrmEntity, value => value.movimientoReversado) reversiones!: MovimientoCajaOrmEntity[];
  @Column({ name: 'usuario_id', type: 'integer' }) usuarioId!: number;
  @ManyToOne(() => UsuarioOrmEntity, { nullable: false, onDelete: 'RESTRICT' }) @JoinColumn({ name: 'usuario_id' }) usuario!: UsuarioOrmEntity;
  @CreateDateColumn({ name: 'fecha_creacion', type: 'timestamp' }) fechaCreacion!: Date;
}
