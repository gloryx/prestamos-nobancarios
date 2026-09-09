import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UsuarioOrmEntity } from '../../../../usuarios/infrastructure/persistence/typeorm/usuario.orm-entity';
import { PagoOrmEntity } from './pago.orm-entity';
import { MotivoAnulacionPago } from '../../../domain/enums/motivo-anulacion-pago.enum';

@Entity('pago_anulacion')
export class PagoAnulacionOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'pago_id', type: 'integer', unique: true }) pagoId!: number;
  @OneToOne(() => PagoOrmEntity, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'pago_id' }) pago!: PagoOrmEntity;
  @Column({ type: 'date' }) fecha!: string;
  @Column({ name: 'usuario_id', type: 'integer' }) usuarioId!: number;
  @ManyToOne(() => UsuarioOrmEntity, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'usuario_id' }) usuario!: UsuarioOrmEntity;
  @Column({ type: 'enum', enum: MotivoAnulacionPago, enumName: 'pago_motivo_anulacion_enum' }) motivo!: MotivoAnulacionPago;
  @Column({ type: 'text', nullable: true }) observacion!: string | null;
  @CreateDateColumn({ name: 'fecha_creacion', type: 'timestamp' }) fechaCreacion!: Date;
}
