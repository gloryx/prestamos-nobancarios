import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UsuarioOrmEntity } from '../../../../usuarios/infrastructure/persistence/typeorm/usuario.orm-entity';
import { EstadoPrestamo } from '../../../domain/enums/estado-prestamo.enum';

@Entity('prestamo_estado_historial')
export class PrestamoEstadoHistorialOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'prestamo_id', type: 'integer' }) prestamoId!: number;
  @Column({ name: 'estado_anterior', type: 'enum', enum: EstadoPrestamo, enumName: 'prestamo_estado_enum', nullable: true }) estadoAnterior!: EstadoPrestamo | null;
  @Column({ name: 'estado_nuevo', type: 'enum', enum: EstadoPrestamo, enumName: 'prestamo_estado_enum' }) estadoNuevo!: EstadoPrestamo;
  @Column({ type: 'date' }) fecha!: string;
  @Column({ name: 'usuario_id', type: 'integer' }) usuarioId!: number;
  @ManyToOne(() => UsuarioOrmEntity, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'usuario_id' }) usuario!: UsuarioOrmEntity;
  @Column({ type: 'text', nullable: true }) observacion!: string | null;
  @CreateDateColumn({ name: 'fecha_creacion', type: 'timestamp' }) fechaCreacion!: Date;
}
