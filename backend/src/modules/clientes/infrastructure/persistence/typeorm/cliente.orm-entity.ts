import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Nacionalidad } from '../../../domain/enums/nacionalidad.enum';
import { Genero } from '../../../domain/enums/genero.enum';

@Entity('cliente')
export class ClienteOrmEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'varchar', length: 30, unique: true }) identificacion!: string;
  @Column({ name: 'primer_nombre', type: 'varchar', length: 100 }) primerNombre!: string;
  @Column({ name: 'segundo_nombre', type: 'varchar', length: 100, nullable: true }) segundoNombre!: string | null;
  @Column({ name: 'primer_apellido', type: 'varchar', length: 100 }) primerApellido!: string;
  @Column({ name: 'segundo_apellido', type: 'varchar', length: 100, nullable: true }) segundoApellido!: string | null;
  @Column({ type: 'enum', enum: Genero, enumName: 'cliente_genero_enum', nullable: true }) genero!: Genero | null;
  @Column({ name: 'fecha_nacimiento', type: 'date', nullable: true }) fechaNacimiento!: string | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) direccion!: string | null;
  @Column({ type: 'varchar', length: 150, nullable: true }) correo!: string | null;
  @Column({ type: 'varchar', length: 30 }) telefono1!: string;
  @Column({ type: 'varchar', length: 30, nullable: true }) telefono2!: string | null;
  @Column({ type: 'enum', enum: Nacionalidad, enumName: 'cliente_nacionalidad_enum', nullable: true }) nacionalidad!: Nacionalidad | null;
  @Column({ type: 'text', nullable: true }) observaciones!: string | null;
  @Column({ name: 'fecha_ingreso', type: 'timestamp' }) fechaIngreso!: Date;
  @Column({ name: 'url_identificacion', type: 'varchar', length: 500, nullable: true }) urlIdentificacion!: string | null;
  @Column({ type: 'boolean', default: true }) activo!: boolean;
}
