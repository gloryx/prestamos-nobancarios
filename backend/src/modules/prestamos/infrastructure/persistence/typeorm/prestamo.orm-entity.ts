import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ClienteOrmEntity } from '../../../../clientes/infrastructure/persistence/typeorm/cliente.orm-entity';
import { FormaPagoOrmEntity } from '../../../../formas-pago/infrastructure/persistence/typeorm/forma-pago.orm-entity';
import { PeriodicidadPagoOrmEntity } from '../../../../periodicidades-pago/infrastructure/persistence/typeorm/periodicidad-pago.orm-entity';
import { EstadoPrestamo } from '../../../domain/enums/estado-prestamo.enum';
import { numberTransformer } from './number.transformer';

@Entity('prestamo')
export class PrestamoOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'cliente_id', type: 'integer' }) clienteId!: number;
  @ManyToOne(() => ClienteOrmEntity, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'cliente_id' }) cliente!: ClienteOrmEntity;
  @Column({ name: 'periodicidad_pago_id', type: 'integer' }) periodicidadPagoId!: number;
  @ManyToOne(() => PeriodicidadPagoOrmEntity, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'periodicidad_pago_id' }) periodicidadPago!: PeriodicidadPagoOrmEntity;
  @Column({ name: 'forma_pago_id', type: 'integer' }) formaPagoId!: number;
  @ManyToOne(() => FormaPagoOrmEntity, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'forma_pago_id' }) formaPago!: FormaPagoOrmEntity;
  @Column({ name: 'forma_desembolso_id', type: 'integer', nullable: true }) formaDesembolsoId!: number | null;
  @ManyToOne(() => FormaPagoOrmEntity, { nullable: true, onDelete: 'RESTRICT' }) @JoinColumn({ name: 'forma_desembolso_id' }) formaDesembolso!: FormaPagoOrmEntity | null;
  @Column({ name: 'fecha_alta', type: 'date' }) fechaAlta!: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: numberTransformer }) capital!: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: numberTransformer }) interes!: number;
  @Column({ name: 'monto_total', type: 'numeric', precision: 14, scale: 2, transformer: numberTransformer }) montoTotal!: number;
  @Column({ name: 'monto_desembolsado', type: 'numeric', precision: 14, scale: 2, transformer: numberTransformer }) montoDesembolsado!: number;
  @Column({ name: 'cantidad_pagos', type: 'integer' }) cantidadPagos!: number;
  @Column({ name: 'plan_personalizado', type: 'boolean' }) planPersonalizado!: boolean;
  @Column({ type: 'enum', enum: EstadoPrestamo, enumName: 'prestamo_estado_enum', default: EstadoPrestamo.ACTIVO }) estado!: EstadoPrestamo;
  @Column({ type: 'text', nullable: true }) observaciones!: string | null;
  @CreateDateColumn({ name: 'fecha_creacion', type: 'timestamp' }) fechaCreacion!: Date;
  @UpdateDateColumn({ name: 'fecha_actualizacion', type: 'timestamp' }) fechaActualizacion!: Date;
}
