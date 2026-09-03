import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { RolUsuario } from '../../../domain/enums/rol-usuario.enum';

@Entity('usuario')
export class UsuarioOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'varchar', length: 30, unique: true }) identificacion!: string;
  @Column({ name: 'nombre_completo', type: 'varchar', length: 200 }) nombreCompleto!: string;
  @Column({ type: 'varchar', length: 30, nullable: true }) telefono!: string | null;
  @Column({ type: 'varchar', length: 150, nullable: true }) correo!: string | null;
  @Column({ type: 'enum', enum: RolUsuario, enumName: 'usuario_rol_enum' }) rol!: RolUsuario;
  @Column({ name: 'password_hash', type: 'varchar', length: 200 }) passwordHash!: string;
  @CreateDateColumn({ name: 'fecha_creacion', type: 'timestamp' }) fechaCreacion!: Date;
  @UpdateDateColumn({ name: 'fecha_actualizacion', type: 'timestamp' }) fechaActualizacion!: Date;
  @Column({ type: 'boolean', default: true }) activo!: boolean;
}
